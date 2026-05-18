import { Channel, OutputChannel } from "./channel";
import type { Smplr } from "./instrument";
import { toMidi } from "./midi";
import { Storage } from "../storage";
import { resolveParams } from "./params";
import { RegionMatcher } from "./region-matcher";
import { SampleLoader } from "./sample-loader";
import { Scheduler } from "./scheduler";
import {
  LoadProgress,
  NoteEvent,
  PlaybackParams,
  SmplrPreset,
  StopFn,
  StopTarget,
} from "./types";
import { Voice } from "./voice";
import { VoiceManager } from "./voice-manager";

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
  /** Shared SampleLoader instance. If omitted, a private one is created. */
  loader?: SampleLoader;
  /** Shared Scheduler instance. If omitted, a private one is created. */
  scheduler?: Scheduler;
  /** Called after each buffer is loaded (or served from cache). */
  onLoadProgress?: (progress: LoadProgress) => void;
  /** Called when a note is dispatched to the audio engine (slightly before playback). */
  onStart?: (event: NoteEvent) => void;
  /** Called when each voice's audio node ends. */
  onEnded?: (event: NoteEvent) => void;
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
  #aliases: Map<string, number> | undefined;
  #matcher: RegionMatcher;
  #voices: VoiceManager;
  #channel: Channel;
  #onLoadProgress: ((progress: LoadProgress) => void) | undefined;
  #onStart: ((event: NoteEvent) => void) | undefined;
  #onEnded: ((event: NoteEvent) => void) | undefined;
  #ccState: Map<number, number> = new Map();
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
    const json = isSmplrJson(jsonOrOptions) ? jsonOrOptions : undefined;
    const options = isSmplrJson(jsonOrOptions)
      ? maybeOptions
      : (jsonOrOptions as SmplrOptions | undefined);

    this.context = context;
    this.#defaults = json?.defaults;
    this.#defaultVelocity = options?.velocity ?? 100;
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
    this.scheduler = options?.scheduler ?? Scheduler(context);

    // 3. Region matcher — pre-processes groups/regions once
    this.#matcher = new RegionMatcher(json ?? EMPTY_JSON);

    // 4. Voice manager — tracks active voices for stop operations
    this.#voices = new VoiceManager();

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
    json: SmplrPreset,
    buffers?: Map<string, AudioBuffer>,
  ): Promise<void> {
    this.#assertNotDisposed("load an instrument");
    const token = ++this.#loadToken;

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
   * Start playing a note. Returns a StopFn that cancels the note if it hasn't
   * played yet, or stops the resulting voices if it has.
   */
  start(event: NoteEvent): StopFn {
    this.#assertNotDisposed("start a note");
    const normalized = this.#normalizeNoteEvent(event);

    const schedulerStop = this.scheduler.schedule(
      normalized as NoteEvent,
      (e) => this.#playNote(e as NormalizedNoteEvent),
    );

    return (time?: number) => {
      schedulerStop(); // cancel from queue if not yet dispatched
      this.#voices.stopById(normalized.stopId, time); // stop if already playing
    };
  }

  /**
   * Stop voices.
   *
   * - No argument → stop all active voices
   * - String or number → stop all voices with that stopId
   * - `{ stopId }` → stop voices with that stopId, optionally at a future time
   * - `{ time }` (no stopId) → stop all voices at a future time
   */
  stop(target?: StopTarget): void {
    this.#assertNotDisposed("stop voices");
    if (target === undefined) {
      this.#voices.stopAll();
    } else if (typeof target === "string" || typeof target === "number") {
      this.#voices.stopById(target);
    } else {
      if (target.stopId !== undefined) {
        this.#voices.stopById(target.stopId, target.time);
      } else {
        this.#voices.stopAll(target.time);
      }
    }
  }

  /**
   * Stop all voices, dispose the output channel, and stop the scheduler.
   * The instance must not be used after this call — subsequent
   * `start`/`stop`/`setCC`/`getCC`/`loadInstrument` calls throw.
   * Subsequent `dispose()` calls are no-ops.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#voices.stopAll();
    this.#channel.disconnect();
    this.scheduler.stop();
  }

  /** @deprecated Use {@link dispose} instead. */
  disconnect(): void {
    this.dispose();
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

  #playNote(event: NormalizedNoteEvent): void {
    const {
      midi,
      velocity,
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

    const matches = this.#matcher.match(midi, velocity, this.#ccState);

    // Stop exclusive groups before starting new voices
    for (const match of matches) {
      if (match.offBy !== undefined) {
        this.#voices.stopGroup(match.offBy, time);
      }
    }

    // Create a voice for each matched region
    let voiceStarted = false;
    const effectiveReverse = reverse ?? this.#defaults?.reverse ?? false;
    for (const match of matches) {
      const buffer = this.#getBuffer(match.sample, effectiveReverse);
      if (!buffer) continue;

      const params = resolveParams(
        this.#defaults,
        match.groupRef,
        match.regionRef,
        midi,
        velocity,
        { detune, lpfCutoffHz, loop, ampRelease, reverse },
      );

      const voice = new Voice(
        this.context,
        buffer,
        params,
        this.#channel.input,
        stopId,
        match.group,
        time,
      );

      this.#voices.add(voice);

      // onStart fires once on the first matched voice
      if (!voiceStarted) {
        onStart?.(event);
        voiceStarted = true;
      }

      // onEnded fires once per voice when its audio node ends
      if (onEnded) {
        voice.onEnded(() => onEnded(event));
      }

      // Auto-stop for duration — schedule directly on the audio timeline
      // so it works in both real-time and offline (OfflineAudioContext) contexts.
      if (duration != null) {
        const startT = time ?? this.context.currentTime;
        const releaseAt = startT + duration;
        voice.stop(releaseAt);
      }
    }
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
