import { Channel, OutputChannel } from "./channel";
import type { Smplr } from "./instrument";
import { toMidi } from "./midi";
import { filterPreset, findNearestKey, NotesToLoad } from "./notes-to-load";
import { Storage } from "../storage";
import { resolveParams } from "./params";
import { RegionMatcher } from "./region-matcher";
import { SampleLoader } from "./sample-loader";
import { Scheduler } from "./scheduler";
import {
  LoadProgress,
  NoteEvent,
  NoteHandle,
  PlaybackParams,
  SmplrPreset,
  StopFn,
  StopTarget,
  VoiceParams,
} from "./types";
import { Voice } from "./voice";
import { Curve, evalCurve } from "./curve";
import { VoiceManager } from "./voice-manager";
import {
  addNoteVoice,
  createNoteHandle,
  createNoteRef,
  dispatchNote,
  NoteRef,
} from "./note-handle";

export type SmplrOptions = {
  /** Custom storage backend for sample fetching (e.g. CacheStorage). */
  storage?: Storage;
  /** Destination audio node. Defaults to context.destination. */
  destination?: AudioNode;
  /** Master volume (0–127 MIDI scale). Defaults to 100. */
  volume?: number;
  /** Custom volume-to-gain mapping function. Defaults to midiVelToGain. */
  volumeToGain?: (volume: number) => number;
  /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). Defaults to 0. */
  pan?: number;
  /** Default note velocity when not specified in NoteEvent (0–127). Defaults to 100. */
  velocity?: number;
  /**
   * Input velocity curve: maps each played velocity (0–127) to the velocity the
   * instrument uses, before choosing velocity layers and computing gain. Use it
   * to adapt the response to a keyboard or a playing style. Defaults to none
   * (velocities are used as played).
   */
  velocityCurve?: Curve;
  /** Shared SampleLoader instance. If omitted, a private one is created. */
  loader?: SampleLoader;
  /** Shared Scheduler instance. If omitted, a private one is created. */
  scheduler?: Scheduler;
  /** Called after each buffer is loaded (or served from cache). */
  onLoadProgress?: (progress: LoadProgress) => void;
  /**
   * Only load the samples needed to play these notes and velocities.
   * Applies to every instrument loaded into this instance.
   */
  notesToLoad?: NotesToLoad;
  /** Called when a note is dispatched to the audio engine (slightly before playback). */
  onStart?: (event: NoteEvent) => void;
  /** Called when each voice's audio node ends. */
  onEnded?: (event: NoteEvent) => void;
  /**
   * Max voices sounding at once for this instrument (a voice is one sample playing: a note
   * can use several, e.g. layered regions). Voices that overlap in time with a new voice count,
   * including ones still releasing. When a new voice would exceed the cap, the oldest voices
   * (already-releasing ones first) are released at its start time; if the rest start at the
   * same time (a chord), the most recently added are cancelled instead, although `onStart`
   * has already fired for them. Rounded down; unlimited when omitted, or when less than 1 or
   * not a number.
   */
  maxVoices?: number;
};

/** Options accepted by `loadInstrument(json, options)`. */
export type LoadInstrumentOptions = {
  /** Pre-decoded buffers keyed by sample name — skip fetch for these. */
  buffers?: Map<string, AudioBuffer>;
  /** Overrides the instance's `notesToLoad` for this load. */
  notesToLoad?: NotesToLoad;
};

/**
 * Fully resolved note event, normalized from the public NoteEvent union type.
 * Used internally after normalization in start().
 */
type NormalizedNoteEvent = {
  note: string | number;
  midi: number;
  velocity: number;
  time?: number;
  duration?: number | null;
  detune?: number;
  lpfCutoffHz?: number;
  loop?: boolean;
  ampRelease?: number;
  reverse?: boolean;
  stopId: string | number;
  onStart?: (event: NoteEvent) => void;
  onEnded?: (event: NoteEvent) => void;
};

/**
 * A note queued in the scheduler that hasn't been dispatched yet (it has no
 * voice). Tracked per instrument so `stop()` can cancel it.
 */
type PendingEvent = {
  stopId: string | number;
  time: number;
  cancel: StopFn;
};

function compose<T>(
  a: ((e: T) => void) | undefined,
  b: ((e: T) => void) | undefined,
): ((e: T) => void) | undefined {
  if (a && b)
    return (e) => {
      a(e);
      b(e);
    };
  return a ?? b;
}

/** Empty RegionMatcher used before loadInstrument() is called. */
const EMPTY_JSON: SmplrPreset = {
  samples: { baseUrl: "", formats: [] },
  groups: [],
};

/**
 * Detect whether an argument is a SmplrPreset descriptor.
 * SmplrPreset always has a `groups` array; SmplrOptions does not.
 */
function isSmplrJson(x: unknown): x is SmplrPreset {
  return (
    typeof x === "object" &&
    x !== null &&
    "groups" in x &&
    Array.isArray((x as SmplrPreset).groups)
  );
}

/**
 * Internal smplr implementation. Loads samples described by a SmplrPreset
 * descriptor, matches notes to regions, and plays them through a Channel.
 *
 * Not exported from the package barrel — third-party plugins receive an
 * instance typed as {@link PluginSmplr} via the {@link Instrument} builder.
 *
 * Pattern A — json provided at construction:
 *   `new SmplrImpl(context, json, options?)`
 *
 * Pattern B — json loaded later via loadInstrument():
 *   `new SmplrImpl(context, options?)`  then  `smplr.loadInstrument(json)`
 */
export class SmplrImpl implements Smplr {
  /** The AudioContext (or OfflineAudioContext) passed to the constructor. */
  readonly context: BaseAudioContext;
  /** Shared SampleLoader. Read-only on the public surface; injectable via SmplrOptions.loader. */
  readonly loader: SampleLoader;
  /** Shared Scheduler. Read-only on the public surface; injectable via SmplrOptions.scheduler. */
  readonly scheduler: Scheduler;

  /**
   * Resolves when the instrument is ready to play. For Pattern A this tracks
   * the constructor-time load; for Pattern B it starts resolved and may be
   * replaced by the {@link Instrument} builder via {@link _setReady}.
   */
  ready: Promise<void>;

  #loadProgress: LoadProgress = { loaded: 0, total: 0 };
  #loadToken = 0;
  #buffers: Map<string, AudioBuffer> = new Map();
  #reversedBuffers: Map<string, AudioBuffer> = new Map();
  #defaults: PlaybackParams | undefined;
  #defaultVelocity: number;
  #velocityCurve: Curve | undefined;
  #aliases: Map<string, number> | undefined;
  #notesToLoad: NotesToLoad | undefined;
  #fallback: NotesToLoad["fallback"];
  #matcher: RegionMatcher;
  #voices: VoiceManager;
  #channel: Channel;
  #onLoadProgress: ((progress: LoadProgress) => void) | undefined;
  #onStart: ((event: NoteEvent) => void) | undefined;
  #onEnded: ((event: NoteEvent) => void) | undefined;
  #ccState: Map<number, number> = new Map();
  #pending: Set<PendingEvent> = new Set();
  #ownsScheduler: boolean;
  #disposed = false;

  #assertNotDisposed(action: string): void {
    if (this.#disposed) {
      throw Error(`Cannot ${action} on a disposed Smplr instance.`);
    }
  }

  constructor(
    context: BaseAudioContext,
    json: SmplrPreset,
    options?: SmplrOptions,
  );
  constructor(context: BaseAudioContext, options?: SmplrOptions);
  constructor(
    context: BaseAudioContext,
    jsonOrOptions?: SmplrPreset | SmplrOptions,
    maybeOptions?: SmplrOptions,
  ) {
    const fullJson = isSmplrJson(jsonOrOptions) ? jsonOrOptions : undefined;
    const options = isSmplrJson(jsonOrOptions)
      ? maybeOptions
      : (jsonOrOptions as SmplrOptions | undefined);

    this.context = context;
    this.#notesToLoad = options?.notesToLoad;
    const json = fullJson && this.#filter(fullJson, this.#notesToLoad);
    this.#defaults = json?.defaults;
    this.#defaultVelocity = options?.velocity ?? 100;
    this.#velocityCurve = options?.velocityCurve;
    this.#onLoadProgress = options?.onLoadProgress;
    this.#onStart = options?.onStart;
    this.#onEnded = options?.onEnded;

    if (json?.aliases) {
      this.#aliases = new Map(Object.entries(json.aliases));
    }

    // 1. Output channel — volume, routing, effects
    this.#channel = new Channel(context, {
      destination: options?.destination,
      volume: options?.volume,
      volumeToGain: options?.volumeToGain,
      pan: options?.pan,
    });

    // 2. Scheduler — shared or private
    this.#ownsScheduler = options?.scheduler === undefined;
    this.scheduler = options?.scheduler ?? Scheduler(context);

    // 3. Region matcher — pre-processes groups/regions once
    this.#matcher = new RegionMatcher(json ?? EMPTY_JSON);

    // 4. Voice manager — tracks active voices for stop operations
    this.#voices = new VoiceManager(options?.maxVoices);

    // 5. Sample loader — shared or private
    this.loader =
      options?.loader ?? SampleLoader(context, { storage: options?.storage });

    if (json) {
      // Pattern A: load immediately
      this.ready = this.loader
        .load(json, {
          onProgress: (loaded, total) => {
            this.#loadProgress = { loaded, total };
            this.#onLoadProgress?.({ loaded, total });
          },
        })
        .then((buffers) => {
          this.#buffers = buffers;
        });
    } else {
      // Pattern B: resolve immediately; caller will call loadInstrument()
      this.ready = Promise.resolve();
    }
  }

  /**
   * @deprecated Use {@link ready} instead. Returns a Promise that resolves
   * to this instance for compatibility with `const x = await new X(ctx).load`.
   */
  get load(): Promise<this> {
    return this.ready.then(() => this);
  }

  /**
   * @internal — only the {@link Instrument} builder should call this. Replaces
   * the `ready` promise after plugin setup completes.
   */
  _setReady(p: Promise<void>): void {
    this.ready = p;
  }

  /**
   * Load (or replace) the instrument descriptor. All state (matcher, defaults,
   * aliases, reversed-buffer cache, sample buffers) swaps atomically when the
   * load resolves. Concurrent calls are serialized: only the latest call's
   * result is committed; earlier in-flight calls resolve but do not mutate
   * state.
   *
   * Pre-loaded buffers (e.g. base64-decoded) can be passed via the `buffers`
   * parameter — those skip the fetch step.
   */
  loadInstrument(
    fullJson: SmplrPreset,
    buffersOrOptions?: Map<string, AudioBuffer> | LoadInstrumentOptions,
  ): Promise<void> {
    this.#assertNotDisposed("load an instrument");
    const token = ++this.#loadToken;
    const options =
      buffersOrOptions instanceof Map
        ? { buffers: buffersOrOptions }
        : buffersOrOptions;
    const buffers = options?.buffers;
    const notesToLoad =
      options && "notesToLoad" in options
        ? options.notesToLoad
        : this.#notesToLoad;
    const { preset: json, filtered } = filterAndWarn(fullJson, notesToLoad);

    return this.loader
      .load(json, {
        buffers,
        onProgress: (loaded, total) => {
          this.#loadProgress = { loaded, total };
          this.#onLoadProgress?.({ loaded, total });
        },
      })
      .then((newBuffers) => {
        if (token !== this.#loadToken) return;
        this.#defaults = json.defaults;
        this.#aliases = json.aliases
          ? new Map(Object.entries(json.aliases))
          : undefined;
        this.#matcher = new RegionMatcher(json);
        this.#fallback = filtered ? notesToLoad?.fallback : undefined;
        this.#reversedBuffers = new Map();
        this.#buffers = newBuffers;
      });
  }

  /** Current loading progress snapshot. `total` is known before loading starts. */
  get loadProgress(): LoadProgress {
    return this.#loadProgress;
  }

  /** The output channel — use to add effects, adjust volume, or route audio. */
  get output(): OutputChannel {
    return this.#channel;
  }

  /**
   * Set a MIDI CC value. Affects region matching for groups/regions that have
   * ccRange constraints (e.g. CC64 sustain pedal).
   */
  setCC(cc: number, value: number): void {
    this.#assertNotDisposed("set CC");
    this.#ccState.set(cc, value);
  }

  /**
   * Read the latest value set via {@link setCC}. Returns `0` for any CC that
   * has not been set (matches MIDI's "undefined controller defaults to 0"
   * convention).
   */
  getCC(cc: number): number {
    this.#assertNotDisposed("read CC");
    return this.#ccState.get(cc) ?? 0;
  }

  /**
   * Input velocity curve applied to every future note before layer selection and
   * gain (see {@link SmplrOptions.velocityCurve}). `undefined` uses velocities as
   * played.
   */
  get velocityCurve(): Curve | undefined {
    return this.#velocityCurve;
  }

  set velocityCurve(curve: Curve | undefined) {
    this.#velocityCurve = curve;
  }

  /**
   * Set the cents detune applied to every future note. Mutates the instrument's
   * playback defaults in place; takes effect on notes scheduled after the call.
   * In-flight notes are unaffected.
   */
  setDetune(cents: number): void {
    this.#assertNotDisposed("set detune");
    if (!this.#defaults) this.#defaults = {};
    this.#defaults.detune = cents;
  }

  /**
   * Set whether every future note plays its sample reversed. The reversed-buffer
   * cache is populated lazily on demand; no cache invalidation is needed in
   * either direction.
   */
  setReverse(reverse: boolean): void {
    this.#assertNotDisposed("set reverse");
    if (!this.#defaults) this.#defaults = {};
    this.#defaults.reverse = reverse;
  }

  /**
   * Start playing a note. Returns a {@link NoteHandle}.
   *
   * Calling the handle cancels the note if it hasn't played yet, or stops every voice with
   * its stopId if it has. Its `fadeTo` and `glideTo` methods act on the voices of this call
   * only.
   */
  start(event: NoteEvent): NoteHandle {
    this.#assertNotDisposed("start a note");
    const normalized = this.#normalizeNoteEvent(event);
    const ref = createNoteRef();

    // Set when the note is queued; the dispatch callback removes it from
    // #pending. A note within the lookahead dispatches synchronously, before
    // `schedule()` returns, so it is never registered.
    let pending: PendingEvent | undefined;
    let dispatched = false;
    const schedulerStop = this.scheduler.schedule(
      normalized as NoteEvent,
      (e) => {
        dispatched = true;
        if (pending) this.#pending.delete(pending);
        this.#playNote(e as NormalizedNoteEvent, ref);
      },
    );
    if (!dispatched) {
      pending = {
        stopId: normalized.stopId,
        time: normalized.time ?? this.context.currentTime,
        cancel: schedulerStop,
      };
      this.#pending.add(pending);
    }

    const stop: StopFn = (time?: number) => {
      // cancel from queue if not yet dispatched
      schedulerStop();
      if (pending) this.#pending.delete(pending);
      // stop if already playing
      this.#voices.stopById(normalized.stopId, time);
    };
    return createNoteHandle(
      ref,
      stop,
      normalized.stopId,
      () => this.context.currentTime,
    );
  }

  /**
   * Stop the voices that are playing and cancel the notes scheduled for later
   * (queued by `start()` with a future `time`, not yet dispatched).
   *
   * - No argument → stop all voices and cancel all scheduled notes
   * - String or number → stop the voices and cancel the scheduled notes with
   *   that stopId
   * - `{ stopId, time? }` → stop the voices with that stopId at `time`, and
   *   cancel the scheduled notes with that stopId that start at or after `time`
   * - `{ time }` (no stopId) → stop all voices at `time`, and cancel the
   *   scheduled notes that start at or after `time`
   *
   * Only affects this instrument, even when its scheduler is shared.
   */
  stop(target?: StopTarget): void {
    this.#assertNotDisposed("stop voices");
    if (target === undefined) {
      this.#cancelPending();
      this.#voices.stopAll();
    } else if (typeof target === "string" || typeof target === "number") {
      this.#cancelPending(target);
      this.#voices.stopById(target);
    } else {
      this.#cancelPending(target.stopId, target.time);
      if (target.stopId !== undefined) {
        this.#voices.stopById(target.stopId, target.time);
      } else {
        this.#voices.stopAll(target.time);
      }
    }
  }

  /**
   * Stop all voices, cancel this instrument's scheduled notes, and dispose the
   * output channel. The scheduler is stopped only if this instance created it
   * (no `scheduler` option): a shared scheduler keeps the notes of the other
   * instruments on it.
   * The instance must not be used after this call — subsequent
   * `start`/`stop`/`setCC`/`getCC`/`loadInstrument` calls throw.
   * Subsequent `dispose()` calls are no-ops.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#cancelPending();
    this.#voices.stopAll();
    this.#channel.disconnect();
    if (this.#ownsScheduler) this.scheduler.stop();
  }

  /** @deprecated Use {@link dispose} instead. */
  disconnect(): void {
    this.dispose();
  }

  /**
   * Cancel the scheduled (not yet dispatched) notes of this instrument that
   * match `stopId` (all when undefined) and start at or after `time` (all
   * when undefined).
   */
  #cancelPending(stopId?: string | number, time?: number): void {
    for (const pending of this.#pending) {
      if (stopId !== undefined && pending.stopId !== stopId) continue;
      if (time !== undefined && pending.time < time) continue;
      pending.cancel();
      this.#pending.delete(pending);
    }
  }

  #getBuffer(sample: string, reverse: boolean): AudioBuffer | undefined {
    if (!reverse) return this.#buffers.get(sample);
    const cached = this.#reversedBuffers.get(sample);
    if (cached) return cached;
    const original = this.#buffers.get(sample);
    if (!original) return undefined;
    const reversed = this.context.createBuffer(
      original.numberOfChannels,
      original.length,
      original.sampleRate,
    );
    for (let ch = 0; ch < original.numberOfChannels; ch++) {
      const data = original.getChannelData(ch).slice().reverse();
      reversed.copyToChannel(data, ch);
    }
    this.#reversedBuffers.set(sample, reversed);
    return reversed;
  }

  #playNote(event: NormalizedNoteEvent, ref?: NoteRef): void {
    const {
      midi,
      time,
      stopId,
      duration,
      detune,
      lpfCutoffHz,
      loop,
      ampRelease,
      reverse,
      onStart,
      onEnded,
    } = event;

    const velocity = this.#velocityCurve
      ? Math.round(127 * evalCurve(this.#velocityCurve, event.velocity / 127))
      : event.velocity;

    // Notes that weren't loaded (see notesToLoad) play the nearest loaded
    // note when fallback is "nearest", pitch-shifted to the played note.
    // Checked per velocity: layers can have samples on different keys.
    let matchMidi = midi;
    if (
      this.#fallback === "nearest" &&
      !this.#matcher.hasMatch(midi, velocity, this.#ccState)
    ) {
      const nearest = findNearestKey(midi, (key) =>
        this.#matcher.hasMatch(key, velocity, this.#ccState),
      );
      if (nearest === undefined) {
        if (ref) dispatchNote(ref);
        return;
      }
      matchMidi = nearest;
    }

    const matches = this.#matcher.match(matchMidi, velocity, this.#ccState);

    // Stop exclusive groups before starting new voices
    for (const match of matches) {
      if (match.offBy !== undefined) {
        this.#voices.stopGroup(match.offBy, time);
      }
    }

    // Resolve every matched region first: the retrigger policy must be applied
    // to older voices before this note's voices exist.
    const effectiveReverse = reverse ?? this.#defaults?.reverse ?? false;
    const planned: {
      match: (typeof matches)[number];
      buffer: AudioBuffer;
      params: ReturnType<typeof resolveParams>;
    }[] = [];
    for (const match of matches) {
      const buffer = this.#getBuffer(match.sample, effectiveReverse);
      if (!buffer) continue;

      // A region without a root pitch plays untransposed at any key, so a
      // fallback to it needs the shift added explicitly.
      const hasPitch =
        match.regionRef.pitch !== undefined ||
        match.regionRef.key !== undefined;
      const fallbackCents = hasPitch ? 0 : (midi - matchMidi) * 100;

      const params = resolveParams(
        this.#defaults,
        match.groupRef,
        match.regionRef,
        midi,
        velocity,
        {
          detune: fallbackCents !== 0 ? (detune ?? 0) + fallbackCents : detune,
          lpfCutoffHz,
          loop,
          ampRelease,
          reverse,
        },
      );
      planned.push({ match, buffer, params });
    }

    // Retrigger: the strongest policy among the matched regions wins.
    const retrigger = strongestRetrigger(
      planned.map((p) => p.params.retrigger),
    );
    if (retrigger !== "layer") {
      this.#voices.retrigger(
        stopId,
        retrigger,
        time ?? this.context.currentTime,
      );
    }

    // Create a voice for each matched region
    let voiceStarted = false;
    for (const { match, buffer, params } of planned) {
      const voice = new Voice(
        this.context,
        buffer,
        params,
        this.#channel.input,
        stopId,
        match.group,
        time,
      );

      // Auto-stop for duration — schedule directly on the audio timeline
      // so it works in both real-time and offline (OfflineAudioContext) contexts. Done before
      // adding the voice so the voice cap knows when it ends.
      if (duration != null) {
        const startT = time ?? this.context.currentTime;
        const releaseAt = startT + duration;
        voice.stop(releaseAt);
      }

      this.#voices.add(voice);
      if (ref) addNoteVoice(ref, voice);

      // onStart fires once on the first matched voice
      if (!voiceStarted) {
        onStart?.(event);
        voiceStarted = true;
      }

      // onEnded fires once per voice when its audio node ends
      if (onEnded) {
        voice.onEnded(() => onEnded(event));
      }
    }

    if (ref) dispatchNote(ref);
  }

  /** Apply notesToLoad to a preset given at construction (Pattern A). */
  #filter(
    fullJson: SmplrPreset,
    notesToLoad: NotesToLoad | undefined,
  ): SmplrPreset {
    const { preset, filtered } = filterAndWarn(fullJson, notesToLoad);
    this.#fallback = filtered ? notesToLoad?.fallback : undefined;
    return preset;
  }

  #normalizeNoteEvent(event: NoteEvent): NormalizedNoteEvent {
    if (typeof event === "string" || typeof event === "number") {
      const midi = toMidi(event) ?? this.#aliases?.get(String(event)) ?? 0;
      return {
        note: event,
        midi,
        velocity: this.#defaultVelocity,
        stopId: event,
        onStart: this.#onStart,
        onEnded: this.#onEnded,
      };
    }
    const midi =
      toMidi(event.note) ?? this.#aliases?.get(String(event.note)) ?? 0;
    return {
      ...event,
      midi,
      velocity: event.velocity ?? this.#defaultVelocity,
      stopId: event.stopId ?? event.note,
      onStart: compose(this.#onStart, event.onStart),
      onEnded: compose(this.#onEnded, event.onEnded),
    };
  }
}

/**
 * {@link filterPreset}, warning once about `notesToLoad.notes` entries that
 * are neither a MIDI number, a note name nor an alias of the preset.
 */
function filterAndWarn(
  json: SmplrPreset,
  notesToLoad: NotesToLoad | undefined,
) {
  const result = filterPreset(json, notesToLoad);
  if (result.unresolved.length > 0) {
    console.warn(
      `smplr: notesToLoad entries not found: ${result.unresolved
        .map((note) => JSON.stringify(note))
        .join(", ")}`,
    );
  }
  return result;
}

/** cut > release > layer. */
function strongestRetrigger(
  modes: (VoiceParams["retrigger"] | undefined)[],
): "layer" | "release" | "cut" {
  if (modes.includes("cut")) return "cut";
  if (modes.includes("release")) return "release";
  return "layer";
}
