import { Channel, OutputChannel } from "./channel";
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
  SmplrJson,
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
  /** Default note velocity when not specified in NoteEvent (0–127). Defaults to 100. */
  velocity?: number;
  /** Shared SampleLoader instance. If omitted, a private one is created. */
  loader?: SampleLoader;
  /** Shared Scheduler instance. If omitted, a private one is created. */
  scheduler?: Scheduler;
  /** Called after each buffer is loaded (or served from cache). */
  onLoadProgress?: (progress: LoadProgress) => void;
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
  stopId: string | number;
};

/** Empty RegionMatcher used before loadInstrument() is called. */
const EMPTY_JSON: SmplrJson = {
  samples: { baseUrl: "", formats: [] },
  groups: [],
};

/**
 * Detect whether an argument is a SmplrJson descriptor.
 * SmplrJson always has a `groups` array; SmplrOptions does not.
 */
function isSmplrJson(x: unknown): x is SmplrJson {
  return (
    typeof x === "object" &&
    x !== null &&
    "groups" in x &&
    Array.isArray((x as SmplrJson).groups)
  );
}

/**
 * The main sampler class. Loads samples described by a SmplrJson descriptor,
 * matches notes to regions, and plays them through a Channel.
 *
 * Multiple Smplr instances can share a SampleLoader (shared cache) and/or a
 * Scheduler (coordinated timing) by passing them via SmplrOptions.
 *
 * Pattern A — json provided at construction:
 *   `new Smplr(context, json, options?)`
 *
 * Pattern B — json loaded later via loadInstrument():
 *   `new Smplr(context, options?)`  then  `smplr.loadInstrument(json)`
 */
export class Smplr {
  /** Resolves with `this` once all sample buffers are loaded. */
  readonly load: Promise<Smplr>;
  /** The AudioContext passed to the constructor. */
  readonly context: AudioContext;

  #loadProgress: LoadProgress = { loaded: 0, total: 0 };
  #buffers: Map<string, AudioBuffer> = new Map();
  #defaults: PlaybackParams | undefined;
  #defaultVelocity: number;
  #aliases: Map<string, number> | undefined;
  #matcher: RegionMatcher;
  #voices: VoiceManager;
  #scheduler: Scheduler;
  #channel: Channel;
  #loader: SampleLoader;
  #onLoadProgress: ((progress: LoadProgress) => void) | undefined;
  #ccState: Map<number, number> = new Map();

  constructor(context: AudioContext, json: SmplrJson, options?: SmplrOptions);
  constructor(context: AudioContext, options?: SmplrOptions);
  constructor(
    context: AudioContext,
    jsonOrOptions?: SmplrJson | SmplrOptions,
    maybeOptions?: SmplrOptions
  ) {
    const json = isSmplrJson(jsonOrOptions) ? jsonOrOptions : undefined;
    const options = isSmplrJson(jsonOrOptions)
      ? maybeOptions
      : (jsonOrOptions as SmplrOptions | undefined);

    this.context = context;
    this.#defaults = json?.defaults;
    this.#defaultVelocity = options?.velocity ?? 100;
    this.#onLoadProgress = options?.onLoadProgress;

    if (json?.aliases) {
      this.#aliases = new Map(Object.entries(json.aliases));
    }

    // 1. Output channel — volume, routing, effects
    this.#channel = new Channel(context, {
      destination: options?.destination,
      volume: options?.volume,
      volumeToGain: options?.volumeToGain,
    });

    // 2. Scheduler — shared or private
    this.#scheduler = options?.scheduler ?? new Scheduler(context);

    // 3. Region matcher — pre-processes groups/regions once
    this.#matcher = new RegionMatcher(json ?? EMPTY_JSON);

    // 4. Voice manager — tracks active voices for stop operations
    this.#voices = new VoiceManager();

    // 5. Sample loader — shared or private
    this.#loader =
      options?.loader ?? new SampleLoader(context, { storage: options?.storage });

    if (json) {
      // Pattern A: load immediately
      this.load = this.#loader
        .load(json, (loaded, total) => {
          this.#loadProgress = { loaded, total };
          this.#onLoadProgress?.({ loaded, total });
        })
        .then((buffers) => {
          this.#buffers = buffers;
          return this;
        });
    } else {
      // Pattern B: resolve immediately; caller will call loadInstrument()
      this.load = Promise.resolve(this);
    }
  }

  /**
   * Load (or replace) the instrument descriptor. Creates a new RegionMatcher
   * and fetches all sample buffers. Pre-loaded buffers (e.g. base64-decoded)
   * can be passed via the `buffers` parameter — those skip the fetch step.
   *
   * Returns a Promise that resolves when all samples are ready.
   */
  loadInstrument(
    json: SmplrJson,
    buffers?: Map<string, AudioBuffer>
  ): Promise<void> {
    this.#defaults = json.defaults;
    this.#aliases = json.aliases
      ? new Map(Object.entries(json.aliases))
      : undefined;
    this.#matcher = new RegionMatcher(json);

    return this.#loader
      .load(json, {
        buffers,
        onProgress: (loaded, total) => {
          this.#loadProgress = { loaded, total };
          this.#onLoadProgress?.({ loaded, total });
        },
      })
      .then((newBuffers) => {
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
    this.#ccState.set(cc, value);
  }

  /**
   * Start playing a note. Returns a StopFn that cancels the note if it hasn't
   * played yet, or stops the resulting voices if it has.
   */
  start(event: NoteEvent): StopFn {
    const normalized = this.#normalizeNoteEvent(event);

    const schedulerStop = this.#scheduler.schedule(
      normalized as NoteEvent,
      (e) => this.#playNote(e as NormalizedNoteEvent)
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
   * Stop all voices, disconnect the output channel, and stop the scheduler.
   * The instance should not be used after this call.
   */
  disconnect(): void {
    this.#voices.stopAll();
    this.#channel.disconnect();
    this.#scheduler.stop();
  }

  #playNote(event: NormalizedNoteEvent): void {
    const { midi, velocity, time, stopId, duration, detune, lpfCutoffHz, loop, ampRelease } =
      event;

    const matches = this.#matcher.match(midi, velocity, this.#ccState);

    // Stop exclusive groups before starting new voices
    for (const match of matches) {
      if (match.offBy !== undefined) {
        this.#voices.stopGroup(match.offBy, time);
      }
    }

    // Create a voice for each matched region
    for (const match of matches) {
      const buffer = this.#buffers.get(match.sample);
      if (!buffer) continue;

      const params = resolveParams(
        this.#defaults,
        match.groupRef,
        match.regionRef,
        midi,
        velocity,
        { detune, lpfCutoffHz, loop, ampRelease }
      );

      const voice = new Voice(
        this.context,
        buffer,
        params,
        this.#channel.input,
        stopId,
        match.group,
        time
      );

      this.#voices.add(voice);

      // Auto-stop for duration
      if (duration != null) {
        const startT = time ?? this.context.currentTime;
        const releaseAt = startT + duration;
        const delayMs = Math.max(0, (releaseAt - this.context.currentTime) * 1000);
        setTimeout(() => voice.stop(releaseAt), delayMs);
      }
    }
  }

  #normalizeNoteEvent(event: NoteEvent): NormalizedNoteEvent {
    if (typeof event === "string" || typeof event === "number") {
      const midi =
        toMidi(event) ?? this.#aliases?.get(String(event)) ?? 0;
      return {
        note: event,
        midi,
        velocity: this.#defaultVelocity,
        stopId: event,
      };
    }
    const midi =
      toMidi(event.note) ?? this.#aliases?.get(String(event.note)) ?? 0;
    return {
      ...event,
      midi,
      velocity: event.velocity ?? this.#defaultVelocity,
      stopId: event.stopId ?? event.note,
    };
  }
}
