import { asConstructable } from "../smplr/as-constructable";
import { parseTicks } from "./time-parser";
import { TransportClock } from "./transport-clock";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SequencerNote = {
  /** Optional identifier for this note. Used as `noteId` in noteOn/noteOff events. Defaults to the note's array index. */
  id?: string | number;
  note: string | number;
  /** Musical position: ticks, "4n", "1m", "2:1", "1:1.5", etc. */
  at: string | number;
  /** Note duration: ticks, "4n", "8n", etc. Omit for a one-shot trigger. */
  duration?: string | number;
  velocity?: number;
  /** Probability (0–100) that this note fires on each pass. Default 100 (always). */
  chance?: number;
  /**
   * Expand into N evenly-spaced sub-notes over `duration`. Requires `duration`;
   * silently ignored if `duration` is omitted. Default 1 (no ratchet). When >1,
   * each sub-note's `noteId` is suffixed with `#0`, `#1`, … so individual
   * ratchet voices can be stopped via `stopNote("id#0")`.
   */
  ratchet?: number;
  /**
   * Multiplicative velocity decay per ratchet step: each step's velocity is
   * scaled by `(1 - decay) ** step_index`. 0 = constant, 1 = silence by last
   * step. Default 0.
   */
  ratchetVelocityDecay?: number;
};

/**
 * Any instrument the Sequencer can drive.
 * Compatible with SplendidGrandPiano, DrumMachine, Smplr, and any object
 * that has a `start()` method accepting note + optional scheduling params.
 */
export type SequencerInstrument = {
  start(event: {
    note: string | number;
    time?: number;
    duration?: number;
    velocity?: number;
    noteId?: string | number;
    onStart?: (event: unknown) => void;
    onEnded?: (event: unknown) => void;
  }): unknown;
};

/** Emitted with "noteOn" and "noteOff" events. */
export type SequencerNoteEvent = {
  noteId: string | number;
  trackIndex: number;
  noteIndex: number;
  note: SequencerNote;
};

/**
 * Time signature as a `{ numerator, denominator }` pair (e.g. `{ numerator: 7, denominator: 8 }`
 * for 7/8). The numerator counts beats per bar; the denominator defines the
 * note value of one beat (4 = quarter note, 8 = eighth note, …).
 */
export type TimeSignature = { numerator: number; denominator: number };

/** Normalise a raw number / TimeSignature / undefined into a TimeSignature. */
function normaliseTimeSignature(
  input: number | TimeSignature | undefined,
): TimeSignature {
  if (input === undefined) return { numerator: 4, denominator: 4 };
  if (typeof input === "number") return { numerator: input, denominator: 4 };
  return input;
}

export type SequencerOptions = {
  bpm?: number;
  ppq?: number;
  /** Time signature. Accepts `4` (interpreted as 4/4) or `{ numerator, denominator }`. */
  timeSignature?: number | TimeSignature;
  loop?: boolean;
  loopStart?: string | number;
  loopEnd?: string | number;
  /** How far ahead (ms) to pre-schedule notes. Default 200. */
  lookaheadMs?: number;
  /** How often (ms) the flush loop runs. Default 50. */
  intervalMs?: number;
  /** Randomise timing (ms) and velocity per note for a human feel. */
  humanize?: { timingMs?: number; velocity?: number };
  /** Emit a "step" event at this interval. Accepts musical notation or ticks: "16n", "8n", ticks, etc. */
  stepSize?: string | number;
};

/**
 * Per-track options accepted by {@link Sequencer.addTrack} and
 * {@link Sequencer.setPatterns}.
 */
export type AddTrackOptions = {
  /**
   * Stable track id. Required to address this track via
   * {@link Sequencer.setTrackVolume}, {@link Sequencer.muteTrack},
   * {@link Sequencer.soloTrack}, etc.
   */
  id?: string;
  /** Per-track humanize. Overrides {@link SequencerOptions.humanize} when set. */
  humanize?: { timingMs?: number; velocity?: number };
  /** Multiplicative velocity scalar in [0, 1+]. Default 1. */
  volume?: number;
  /** When true, this track does not dispatch any notes. Default false. */
  muted?: boolean;
  /**
   * When true, only soloed tracks dispatch notes. If any track in the pattern
   * is soloed, every non-soloed track is silenced. Default false.
   */
  solo?: boolean;
};

/**
 * Public shape for one pattern accepted by {@link Sequencer.setPatterns}.
 */
export type PatternInput = {
  tracks: Array<
    {
      instrument: SequencerInstrument;
      notes: SequencerNote[];
    } & AddTrackOptions
  >;
  /**
   * Pattern length override in ticks or musical time. Defaults to the longest
   * track in this pattern.
   */
  loopEnd?: string | number;
};

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type StopFn = (time?: number) => void;

type Track = {
  instrument: SequencerInstrument;
  notes: SequencerNote[];
  id?: string;
  /** Per-track humanize override; undefined → fall back to the sequencer's global humanize. */
  humanize?: { timing: number; velocity: number };
  volume: number;
  muted: boolean;
  solo: boolean;
};

type RepeatEvent = {
  callback: (time: number) => void;
  intervalTicks: number;
  /** Next tick at which this event should fire. Advances after each firing. */
  nextTick: number;
  /** Original start tick, used to reset on loop/seek. */
  startTick: number;
};

type Pattern = {
  tracks: Track[];
  /** Pattern length override in ticks; null = default to longest track. */
  loopEndOverride: number | null;
  /** Cached pattern length: max(at + duration) across all tracks. */
  totalTicks: number;
};

// ---------------------------------------------------------------------------
// Sequencer
// ---------------------------------------------------------------------------

class SequencerImpl {
  private readonly _context: BaseAudioContext;
  private readonly _clock: TransportClock;
  private readonly _ppq: number;

  private _timeSignature: TimeSignature;
  private _stepTicks: number | undefined;
  /**
   * Patterns. Always at least one (the implicit default pattern). Replaced
   * atomically by {@link setPatterns}.
   */
  private _patterns: Pattern[] = [
    { tracks: [], loopEndOverride: null, totalTicks: 0 },
  ];
  /** Indices into {@link _patterns} defining playback order. */
  private _chainOrder: number[] = [0];
  /** Current position within {@link _chainOrder}. */
  private _chainIndex = 0;
  /**
   * True once {@link setPatterns} has been called. After this point,
   * `addTrack` / `removeTrack` / `clearTracks` throw because the chain shape
   * is owned by the patterns array.
   */
  private _patternsExplicit = false;
  private _repeatEvents: RepeatEvent[] = [];
  private _listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  // Loop
  private _loop: boolean;
  private _loopStartTick: number;

  // Timing
  private _lookaheadSec: number;
  private _intervalMs: number;
  private _humanize: { timing: number; velocity: number };

  // Flush loop state
  private _intervalId: ReturnType<typeof setInterval> | undefined;
  /** AudioContext time high-water mark: notes up to here have been scheduled. */
  private _scheduledThrough = 0;
  /** Guards against scheduling the auto-stop setTimeout more than once. */
  private _endScheduled = false;
  /** Active voices keyed by noteId, so individual notes can be stopped. */
  private _activeVoices: Map<string | number, StopFn> = new Map();

  constructor(context: BaseAudioContext, options: SequencerOptions = {}) {
    this._context = context;
    this._ppq = options.ppq ?? 480;
    this._timeSignature = normaliseTimeSignature(options.timeSignature);

    this._clock = new TransportClock(context, {
      bpm: options.bpm ?? 120,
      ppq: this._ppq,
      timeSignature: this._timeSignature,
    });

    this._loop = options.loop ?? false;
    this._loopStartTick =
      options.loopStart !== undefined
        ? parseTicks(options.loopStart, this._ppq, this._timeSignature)
        : 0;

    if (options.loopEnd !== undefined) {
      this._patterns[0].loopEndOverride = parseTicks(
        options.loopEnd,
        this._ppq,
        this._timeSignature,
      );
    }

    this._stepTicks =
      options.stepSize !== undefined
        ? parseTicks(options.stepSize, this._ppq, this._timeSignature)
        : undefined;

    this._lookaheadSec = (options.lookaheadMs ?? 200) / 1000;
    this._intervalMs = options.intervalMs ?? 50;
    this._humanize = {
      timing: options.humanize?.timingMs ?? 0,
      velocity: options.humanize?.velocity ?? 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Tracks
  // ---------------------------------------------------------------------------

  /**
   * Add a track to the (implicit, default) pattern. Throws after
   * {@link setPatterns} has been called — use {@link setPatterns} to mutate
   * the chain.
   */
  addTrack(
    instrument: SequencerInstrument,
    notes: SequencerNote[],
    options?: AddTrackOptions,
  ): this {
    this._assertImplicitPattern("addTrack");
    const pattern = this._patterns[0];
    pattern.tracks.push(this._buildTrack(instrument, notes, options));
    pattern.totalTicks = this._computePatternTotalTicks(pattern);
    return this;
  }

  removeTrack(instrument: SequencerInstrument): this {
    this._assertImplicitPattern("removeTrack");
    const pattern = this._patterns[0];
    pattern.tracks = pattern.tracks.filter((t) => t.instrument !== instrument);
    pattern.totalTicks = this._computePatternTotalTicks(pattern);
    return this;
  }

  clearTracks(): this {
    this._assertImplicitPattern("clearTracks");
    const pattern = this._patterns[0];
    pattern.tracks = [];
    pattern.totalTicks = 0;
    return this;
  }

  /**
   * Replace the sequencer's patterns. Each pattern owns its own tracks and
   * optional `loopEnd`. After this call, `addTrack` / `removeTrack` /
   * `clearTracks` throw — the chain is owned by the patterns array.
   *
   * `chainOrder` is reset to `[0, 1, …, patterns.length - 1]`.
   */
  setPatterns(patterns: PatternInput[]): this {
    if (patterns.length === 0) {
      throw new Error("setPatterns requires at least one pattern");
    }
    this._patterns = patterns.map((p) => {
      const built: Pattern = {
        tracks: p.tracks.map((t) => this._buildTrack(t.instrument, t.notes, t)),
        loopEndOverride:
          p.loopEnd !== undefined
            ? parseTicks(p.loopEnd, this._ppq, this._timeSignature)
            : null,
        totalTicks: 0,
      };
      built.totalTicks = this._computePatternTotalTicks(built);
      return built;
    });
    this._chainOrder = this._patterns.map((_, i) => i);
    this._chainIndex = 0;
    this._patternsExplicit = true;
    return this;
  }

  /** Current chain order: indices into the patterns array, in playback order. */
  get chainOrder(): number[] {
    return [...this._chainOrder];
  }

  /**
   * Set a new chain order. Each entry must be a valid pattern index.
   * Throws if `order` is empty or contains an out-of-range index.
   */
  set chainOrder(order: number[]) {
    if (order.length === 0) {
      throw new Error("chainOrder must not be empty");
    }
    for (const idx of order) {
      if (idx < 0 || idx >= this._patterns.length) {
        throw new Error(`chainOrder index ${idx} out of range`);
      }
    }
    this._chainOrder = [...order];
    if (this._chainIndex >= order.length) this._chainIndex = 0;
  }

  /**
   * Set a track's multiplicative volume scalar. Affects every note dispatched
   * by the track from the next flush onwards. No-op if no track has the
   * given id. Search is scoped to the currently-playing pattern.
   */
  setTrackVolume(id: string, volume: number): this {
    const t = this._findTrack(id);
    if (t) t.volume = volume;
    return this;
  }

  /** Mute a track by id. No-op if no track has the given id. */
  muteTrack(id: string): this {
    return this._setTrackFlag(id, "muted", true);
  }

  /** Unmute a track by id. No-op if no track has the given id. */
  unmuteTrack(id: string): this {
    return this._setTrackFlag(id, "muted", false);
  }

  /** Solo a track by id. While any track is soloed, non-soloed tracks are silenced. */
  soloTrack(id: string): this {
    return this._setTrackFlag(id, "solo", true);
  }

  /** Remove the solo flag from a track. */
  unsoloTrack(id: string): this {
    return this._setTrackFlag(id, "solo", false);
  }

  /**
   * Locate a track by id, scoped to the currently-playing pattern.
   */
  private _findTrack(id: string): Track | undefined {
    return this._currentPattern().tracks.find((t) => t.id === id);
  }

  private _setTrackFlag(
    id: string,
    flag: "muted" | "solo",
    value: boolean,
  ): this {
    const t = this._findTrack(id);
    if (t) t[flag] = value;
    return this;
  }

  private _buildTrack(
    instrument: SequencerInstrument,
    notes: SequencerNote[],
    options?: AddTrackOptions,
  ): Track {
    return {
      instrument,
      notes,
      id: options?.id,
      humanize: options?.humanize
        ? {
            timing: options.humanize.timingMs ?? 0,
            velocity: options.humanize.velocity ?? 0,
          }
        : undefined,
      volume: options?.volume ?? 1,
      muted: options?.muted ?? false,
      solo: options?.solo ?? false,
    };
  }

  private _currentPattern(): Pattern {
    return (
      this._patterns[this._chainOrder[this._chainIndex]] ?? this._patterns[0]
    );
  }

  private _assertImplicitPattern(method: string): void {
    if (this._patternsExplicit) {
      throw new Error(
        `${method}() is not available after setPatterns(); use setPatterns() to update the chain.`,
      );
    }
  }

  private _computePatternTotalTicks(pattern: Pattern): number {
    let max = 0;
    for (const track of pattern.tracks) {
      for (const note of track.notes) {
        const atTick = parseTicks(note.at, this._ppq, this._timeSignature);
        const durTick =
          note.duration !== undefined
            ? parseTicks(note.duration, this._ppq, this._timeSignature)
            : 0;
        max = Math.max(max, atTick + durTick);
      }
    }
    return max;
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------

  get state() {
    return this._clock.state;
  }

  /**
   * Start playback from `offsetTick`, or resume from pause if no offset given.
   */
  start(offsetTick?: number): this {
    if (this._clock.state === "playing") return this;

    if (this._clock.state === "paused" && offsetTick === undefined) {
      // Resume
      this._clock.resume();
      this._scheduledThrough = this._context.currentTime;
      this._startLoop();
      this._emitStateChange("playing");
      return this;
    }

    const startTick = offsetTick ?? 0;
    this._clock.start(startTick);
    this._scheduledThrough = this._context.currentTime;
    this._endScheduled = false;
    this._chainIndex = 0;
    this._resetRepeatEvents(startTick);
    this._startLoop();
    this._emitStateChange("playing");
    return this;
  }

  pause(): this {
    if (this._clock.state !== "playing") return this;
    this._clock.pause();
    this._stopLoop();
    this._emitStateChange("paused");
    return this;
  }

  stop(): this {
    this._clock.stop();
    this._stopLoop();
    this._endScheduled = false;
    this._activeVoices.clear();
    this._emitStateChange("stopped");
    return this;
  }

  /**
   * Stop a single note that was scheduled by the sequencer.
   * @param noteId  The id of the note (from SequencerNote.id or auto-assigned index).
   * @param time    Optional AudioContext time to schedule the stop.
   */
  stopNote(noteId: string | number, time?: number): this {
    const stopFn = this._activeVoices.get(noteId);
    if (stopFn) {
      stopFn(time);
      this._activeVoices.delete(noteId);
    }
    return this;
  }

  /**
   * Toggle between playing and paused. If stopped, starts from the beginning.
   */
  togglePlayPause(): this {
    if (this._clock.state === "playing") return this.pause();
    return this.start();
  }

  // ---------------------------------------------------------------------------
  // Tempo
  // ---------------------------------------------------------------------------

  get bpm(): number {
    return this._clock.bpm;
  }

  set bpm(value: number) {
    this._clock.bpm = value;
  }

  get timeSignature(): TimeSignature {
    return { ...this._timeSignature };
  }

  set timeSignature(value: number | TimeSignature) {
    this._timeSignature = normaliseTimeSignature(value);
    this._clock.timeSignature = this._timeSignature;
    for (const p of this._patterns) {
      p.totalTicks = this._computePatternTotalTicks(p);
    }
  }

  // ---------------------------------------------------------------------------
  // Position
  // ---------------------------------------------------------------------------

  /** Current transport position as "bar:beat:tick" (1-indexed). */
  get position(): string {
    return this._tickToPosition(this._clock.currentTick);
  }

  /**
   * Seek to a position. Accepts ticks or any time string ("2:1", "4n", …).
   * Works while playing (seamless) or stopped/paused.
   */
  set position(value: string | number) {
    const targetTick = parseTicks(
      String(value),
      this._ppq,
      this._timeSignature,
    );
    this._clock.seek(targetTick);
    if (this._clock.state === "playing") {
      this._scheduledThrough = this._context.currentTime;
      this._endScheduled = false;
      this._resetRepeatEvents(targetTick);
    }
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  get loop(): boolean {
    return this._loop;
  }

  set loop(value: boolean) {
    this._loop = value;
  }

  /** Loop start in ticks. */
  get loopStart(): number {
    return this._loopStartTick;
  }

  set loopStart(value: string | number) {
    this._loopStartTick = parseTicks(
      String(value),
      this._ppq,
      this._timeSignature,
    );
  }

  /**
   * Loop end in ticks for the currently-playing pattern. Defaults to the end
   * of the pattern's longest track.
   */
  get loopEnd(): number {
    const p = this._currentPattern();
    return p.loopEndOverride ?? p.totalTicks;
  }

  set loopEnd(value: string | number) {
    this._currentPattern().loopEndOverride = parseTicks(
      String(value),
      this._ppq,
      this._timeSignature,
    );
  }

  /**
   * Normalised loop position [0, 1]. Always 0 when loop=false.
   */
  get progress(): number {
    if (!this._loop) return 0;
    const loopEnd = this.loopEnd;
    const duration = loopEnd - this._loopStartTick;
    if (duration <= 0) return 0;
    const tick = this._clock.currentTick;
    return Math.max(0, Math.min(1, (tick - this._loopStartTick) / duration));
  }

  // ---------------------------------------------------------------------------
  // Callback scheduling (pattern API)
  // ---------------------------------------------------------------------------

  /**
   * Schedule a callback to fire on every `interval` while the sequencer plays.
   * Returns a cancel function.
   *
   * @param callback  Called with the exact AudioContext time of each firing.
   * @param interval  Musical interval: "4n", "8n", "1m", ticks, etc.
   * @param startAt   First firing position (default 0 = beginning).
   */
  scheduleRepeat(
    callback: (time: number) => void,
    interval: string | number,
    startAt: string | number = 0,
  ): () => void {
    const intervalTicks = parseTicks(
      String(interval),
      this._ppq,
      this._timeSignature,
    );
    const startTick = parseTicks(
      String(startAt),
      this._ppq,
      this._timeSignature,
    );
    const event: RepeatEvent = {
      callback,
      intervalTicks,
      nextTick: startTick,
      startTick,
    };
    this._repeatEvents.push(event);
    return () => {
      this._repeatEvents = this._repeatEvents.filter((e) => e !== event);
    };
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * Listen to a sequencer event.
   *
   * | Event           | Args                                              |
   * |-----------------|---------------------------------------------------|
   * | "statechange"   | (state: "playing" \| "paused" \| "stopped")       |
   * | "start"         |                                                   |
   * | "stop"          |                                                   |
   * | "pause"         |                                                   |
   * | "end"           |                                                   |
   * | "loop"          |                                                   |
   * | "patternChange" | (patternIndex: number, time: number)              |
   * | "beat"          | (beat: number, time: number)                      |
   * | "bar"           | (bar: number, time: number)                       |
   * | "step"          | (stepIndex: number, time: number)                 |
   * | "noteOn"        | (event: SequencerNoteEvent)                       |
   * | "noteOff"       | (event: SequencerNoteEvent)                       |
   */
  on(event: string, callback: (...args: any[]) => void): this {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(callback);
    return this;
  }

  off(event: string, callback: (...args: any[]) => void): this {
    this._listeners.get(event)?.delete(callback);
    return this;
  }

  // ---------------------------------------------------------------------------
  // Private — interval management
  // ---------------------------------------------------------------------------

  private _startLoop(): void {
    if (this._intervalId !== undefined) return;
    this._intervalId = setInterval(() => this._flush(), this._intervalMs);
  }

  private _stopLoop(): void {
    if (this._intervalId !== undefined) {
      clearInterval(this._intervalId);
      this._intervalId = undefined;
    }
  }

  // ---------------------------------------------------------------------------
  // Private — flush loop (the timing engine)
  // ---------------------------------------------------------------------------

  private _flush(): void {
    const now = this._context.currentTime;
    const windowEnd = now + this._lookaheadSec;

    const fromTick = this._clock.audioTimeToTick(this._scheduledThrough);
    const toTick = this._clock.audioTimeToTick(windowEnd);

    const pattern = this._currentPattern();
    const isMultiPattern = this._chainOrder.length > 1;
    const patternEndTick = pattern.loopEndOverride ?? pattern.totalTicks;
    const isLastInChain = this._chainIndex === this._chainOrder.length - 1;
    // Single-pattern restart uses the configured loopStart; chain patterns
    // always restart from tick 0 of the next pattern.
    const patternStartTick = isMultiPattern ? 0 : this._loopStartTick;

    // Cross-boundary: advance chain (or wrap a looping single pattern).
    // Single-pattern + !loop falls through to the auto-stop path below.
    const willAdvance =
      patternEndTick > patternStartTick &&
      toTick >= patternEndTick &&
      (isMultiPattern || this._loop) &&
      !(isLastInChain && !this._loop);

    if (willAdvance) {
      // Part 1: notes up to the pattern boundary.
      this._scheduleWindow(fromTick, patternEndTick);

      const restartAudioTime = this._clock.tickToAudioTime(patternEndTick);

      if (isMultiPattern) {
        this._chainIndex = (this._chainIndex + 1) % this._chainOrder.length;
        this._emit(
          "patternChange",
          this._chainOrder[this._chainIndex],
          restartAudioTime,
        );
        // Wrapping the chain back to index 0 also counts as a loop.
        if (this._chainIndex === 0) {
          this._emit("loop");
        }
      } else {
        this._emit("loop");
      }

      const nextStartTick = isMultiPattern ? 0 : this._loopStartTick;
      this._clock.seekAt(nextStartTick, restartAudioTime);
      this._resetRepeatEvents(nextStartTick);

      // Part 2: overflow into the new pattern within the same window.
      const overflowToTick = this._clock.audioTimeToTick(windowEnd);
      this._scheduleWindow(nextStartTick, overflowToTick);

      this._scheduledThrough = windowEnd;
      return;
    }

    this._scheduleWindow(fromTick, toTick);
    this._scheduledThrough = windowEnd;

    // Auto-stop once we've passed the end of the last pattern in the chain
    // (or the only pattern in non-loop mode). Uses the pattern's loopEnd
    // override when set; otherwise falls back to the longest-track length.
    if (
      !this._loop &&
      !this._endScheduled &&
      isLastInChain &&
      patternEndTick > 0 &&
      toTick >= patternEndTick
    ) {
      this._endScheduled = true;
      const endAudioTime = this._clock.tickToAudioTime(patternEndTick);
      const delay = Math.max(0, (endAudioTime - now) * 1000);
      setTimeout(() => {
        this._stopLoop();
        this._clock.stop();
        this._emit("end");
        this._emit("statechange", "stopped");
      }, delay);
    }
  }

  // ---------------------------------------------------------------------------
  // Private — window scheduling
  // ---------------------------------------------------------------------------

  private _scheduleWindow(fromTick: number, toTick: number): void {
    // ---- Track notes (current pattern) ----
    const tracks = this._currentPattern().tracks;
    const anySolo = tracks.some((t) => t.solo);

    for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
      const track = tracks[trackIndex];
      if (track.muted) continue;
      if (anySolo && !track.solo) continue;

      const trackHumanize = track.humanize ?? this._humanize;

      for (let noteIndex = 0; noteIndex < track.notes.length; noteIndex++) {
        const note = track.notes[noteIndex];
        const noteTick = parseTicks(note.at, this._ppq, this._timeSignature);
        if (noteTick < fromTick || noteTick >= toTick) continue;

        // Chance gate — re-rolled every pass through the scheduler
        if (note.chance !== undefined && note.chance < 100) {
          if (Math.random() * 100 >= note.chance) continue;
        }

        const audioTime = this._clock.tickToAudioTime(noteTick);
        const durationSec =
          note.duration !== undefined
            ? this._clock.tickDuration(
                parseTicks(note.duration, this._ppq, this._timeSignature),
              )
            : undefined;

        const timingOffset = trackHumanize.timing
          ? ((Math.random() * 2 - 1) * trackHumanize.timing) / 1000
          : 0;
        const velocityOffset = trackHumanize.velocity
          ? Math.round((Math.random() * 2 - 1) * trackHumanize.velocity)
          : 0;

        const baseNoteId = note.id ?? noteIndex;
        const noteEvent: SequencerNoteEvent = {
          noteId: baseNoteId,
          trackIndex,
          noteIndex,
          note,
        };

        const ratchetCount =
          note.ratchet && note.ratchet > 1 && durationSec !== undefined
            ? Math.floor(note.ratchet)
            : 1;
        const ratchetDecay = note.ratchetVelocityDecay ?? 0;
        const ratchetStepSec =
          ratchetCount > 1 && durationSec !== undefined
            ? durationSec / ratchetCount
            : 0;
        const ratchetDurationSec =
          ratchetCount > 1 ? ratchetStepSec : durationSec;

        for (let r = 0; r < ratchetCount; r++) {
          const ratchetOffsetSec = r * ratchetStepSec;
          const ratchetVelocityScale =
            ratchetCount > 1 ? Math.pow(1 - ratchetDecay, r) : 1;
          const subNoteId =
            ratchetCount > 1 ? `${baseNoteId}#${r}` : baseNoteId;

          const result = track.instrument.start({
            note: note.note,
            time: Math.max(0, audioTime + timingOffset + ratchetOffsetSec),
            duration: ratchetDurationSec,
            velocity:
              (note.velocity ?? 100) * track.volume * ratchetVelocityScale +
              velocityOffset,
            noteId: subNoteId,
            onStart: () => this._emit("noteOn", noteEvent),
            onEnded: () => {
              this._activeVoices.delete(subNoteId);
              this._emit("noteOff", noteEvent);
            },
          });

          // Capture the stop function if the instrument returns one
          if (typeof result === "function") {
            this._activeVoices.set(subNoteId, result as StopFn);
          }
        }
      }
    }

    // ---- Repeat events (callback API) ----
    for (const rep of this._repeatEvents) {
      while (rep.nextTick >= fromTick && rep.nextTick < toTick) {
        rep.callback(this._clock.tickToAudioTime(rep.nextTick));
        rep.nextTick += rep.intervalTicks;
      }
    }

    // ---- Beat / bar events ----
    this._emitBeatsInWindow(fromTick, toTick);

    // ---- Step events ----
    this._emitStepsInWindow(fromTick, toTick);
  }

  // ---------------------------------------------------------------------------
  // Private — beat / bar events
  // ---------------------------------------------------------------------------

  private _emitStepsInWindow(fromTick: number, toTick: number): void {
    if (!this._stepTicks) return;
    const firstStep =
      Math.ceil((fromTick - 0.001) / this._stepTicks) * this._stepTicks;
    for (let t = firstStep; t < toTick; t += this._stepTicks) {
      if (t < 0) continue;
      const stepIndex = Math.floor(t / this._stepTicks);
      const audioTime = this._clock.tickToAudioTime(t);
      this._emit("step", stepIndex, audioTime);
    }
  }

  private _emitBeatsInWindow(fromTick: number, toTick: number): void {
    const beatTicks = this._ppq * (4 / this._timeSignature.denominator);
    const barTicks = beatTicks * this._timeSignature.numerator;

    // Small tolerance so floating-point drift doesn't skip a beat at tick=0.
    const firstBeat = Math.ceil((fromTick - 0.001) / beatTicks) * beatTicks;

    for (let t = firstBeat; t < toTick; t += beatTicks) {
      if (t < 0) continue;
      const audioTime = this._clock.tickToAudioTime(t);
      // 1-indexed absolute beat number from the start of the score.
      const beat = Math.floor(t / beatTicks) + 1;
      this._emit("beat", beat, audioTime);
      if (t % barTicks === 0) {
        const bar = Math.floor(t / barTicks) + 1;
        this._emit("bar", bar, audioTime);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private — utilities
  // ---------------------------------------------------------------------------

  private _emit(event: string, ...args: any[]): void {
    const handlers = this._listeners.get(event);
    if (handlers) {
      for (const fn of handlers) {
        fn(...args);
      }
    }
  }

  /** Emit both the specific state event ("start"/"pause"/"stop") and the unified "statechange" event. */
  private _emitStateChange(state: "playing" | "paused" | "stopped"): void {
    const eventName =
      state === "playing" ? "start" : state === "paused" ? "pause" : "stop";
    this._emit(eventName);
    this._emit("statechange", state);
  }

  /** Format a raw tick count as "bar:beat:tick" (all 1-indexed). */
  private _tickToPosition(tick: number): string {
    const beatTicks = this._ppq * (4 / this._timeSignature.denominator);
    const barTicks = beatTicks * this._timeSignature.numerator;
    const bar = Math.floor(tick / barTicks) + 1;
    const ticksInBar = tick % barTicks;
    const beat = Math.floor(ticksInBar / beatTicks) + 1;
    const ticksInBeat = Math.round(ticksInBar % beatTicks);
    return `${bar}:${beat}:${ticksInBeat}`;
  }

  /**
   * Reset all repeat events so their next firing is the first occurrence
   * at or after `fromTick`.
   */
  private _resetRepeatEvents(fromTick: number): void {
    for (const rep of this._repeatEvents) {
      rep.nextTick = rep.startTick;
      if (fromTick > rep.startTick && rep.intervalTicks > 0) {
        const steps = Math.ceil((fromTick - rep.startTick) / rep.intervalTicks);
        rep.nextTick = rep.startTick + steps * rep.intervalTicks;
      }
    }
  }
}

export const Sequencer = asConstructable(SequencerImpl);
export type Sequencer = ReturnType<typeof Sequencer>;
