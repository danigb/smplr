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

export type SequencerOptions = {
  bpm?: number;
  ppq?: number;
  timeSignature?: number;
  loop?: boolean;
  loopStart?: string | number;
  loopEnd?: string | number;
  /** How far ahead (ms) to pre-schedule notes. Default 200. */
  lookaheadMs?: number;
  /** How often (ms) the flush loop runs. Default 50. */
  intervalMs?: number;
  /** Randomise timing (ms) and velocity per note for a human feel. */
  humanize?: { timingMs?: number; velocity?: number };
};

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type StopFn = (time?: number) => void;

type Track = {
  instrument: SequencerInstrument;
  notes: SequencerNote[];
};

type RepeatEvent = {
  callback: (time: number) => void;
  intervalTicks: number;
  /** Next tick at which this event should fire. Advances after each firing. */
  nextTick: number;
  /** Original start tick, used to reset on loop/seek. */
  startTick: number;
};

// ---------------------------------------------------------------------------
// Sequencer
// ---------------------------------------------------------------------------

export class Sequencer {
  private readonly _context: BaseAudioContext;
  private readonly _clock: TransportClock;
  private readonly _ppq: number;

  private _timeSignature: number;
  private _tracks: Track[] = [];
  private _repeatEvents: RepeatEvent[] = [];
  private _listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  // Loop
  private _loop: boolean;
  private _loopStartTick: number;
  /** null = default to _totalTicks */
  private _loopEndOverride: number | null = null;

  // Timing
  private _lookaheadSec: number;
  private _intervalMs: number;
  private _humanize: { timing: number; velocity: number };

  // Flush loop state
  private _intervalId: ReturnType<typeof setInterval> | undefined;
  /** AudioContext time high-water mark: notes up to here have been scheduled. */
  private _scheduledThrough = 0;
  /** Computed from track notes; the tick where the last note ends. */
  private _totalTicks = 0;
  /** Guards against scheduling the auto-stop setTimeout more than once. */
  private _endScheduled = false;
  /** Active voices keyed by noteId, so individual notes can be stopped. */
  private _activeVoices: Map<string | number, StopFn> = new Map();

  constructor(context: BaseAudioContext, options: SequencerOptions = {}) {
    this._context = context;
    this._ppq = options.ppq ?? 480;
    this._timeSignature = options.timeSignature ?? 4;

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
      this._loopEndOverride = parseTicks(
        options.loopEnd,
        this._ppq,
        this._timeSignature
      );
    }

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

  addTrack(instrument: SequencerInstrument, notes: SequencerNote[]): this {
    this._tracks.push({ instrument, notes });
    this._recomputeTotalTicks();
    return this;
  }

  removeTrack(instrument: SequencerInstrument): this {
    this._tracks = this._tracks.filter((t) => t.instrument !== instrument);
    this._recomputeTotalTicks();
    return this;
  }

  clearTracks(): this {
    this._tracks = [];
    this._totalTicks = 0;
    return this;
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

  get timeSignature(): number {
    return this._timeSignature;
  }

  set timeSignature(value: number) {
    this._timeSignature = value;
    this._clock.timeSignature = value;
    this._recomputeTotalTicks();
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
    const targetTick = parseTicks(String(value), this._ppq, this._timeSignature);
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
    this._loopStartTick = parseTicks(String(value), this._ppq, this._timeSignature);
  }

  /** Loop end in ticks. Defaults to the end of the longest track. */
  get loopEnd(): number {
    return this._loopEndOverride ?? this._totalTicks;
  }

  set loopEnd(value: string | number) {
    this._loopEndOverride = parseTicks(String(value), this._ppq, this._timeSignature);
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
    startAt: string | number = 0
  ): () => void {
    const intervalTicks = parseTicks(String(interval), this._ppq, this._timeSignature);
    const startTick = parseTicks(String(startAt), this._ppq, this._timeSignature);
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
   * | Event          | Args                                              |
   * |----------------|---------------------------------------------------|
   * | "statechange"  | (state: "playing" \| "paused" \| "stopped")       |
   * | "start"        |                                                   |
   * | "stop"         |                                                   |
   * | "pause"        |                                                   |
   * | "end"          |                                                   |
   * | "loop"         |                                                   |
   * | "beat"         | (beat: number, time: number)                      |
   * | "bar"          | (bar: number, time: number)                       |
   * | "noteOn"       | (event: SequencerNoteEvent)                       |
   * | "noteOff"      | (event: SequencerNoteEvent)                       |
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

    if (this._loop) {
      const loopEndTick = this.loopEnd;

      if (toTick >= loopEndTick && loopEndTick > this._loopStartTick) {
        // Window crosses the loop boundary.

        // Part 1: notes from the current position up to loop end.
        this._scheduleWindow(fromTick, loopEndTick);

        // Compute the exact audio time of the loop restart, then re-anchor
        // the clock. Any future tickToAudioTime / audioTimeToTick calls will
        // operate in the new iteration's tick space.
        const loopRestartAudioTime = this._clock.tickToAudioTime(loopEndTick);
        this._clock.seekAt(this._loopStartTick, loopRestartAudioTime);
        this._emit("loop");
        this._resetRepeatEvents(this._loopStartTick);

        // Part 2: overflow notes from loop start into the remainder of the window.
        // After seekAt, audioTimeToTick(windowEnd) is in the new iteration.
        const overflowToTick = this._clock.audioTimeToTick(windowEnd);
        this._scheduleWindow(this._loopStartTick, overflowToTick);

        this._scheduledThrough = windowEnd;
        return;
      }
    }

    this._scheduleWindow(fromTick, toTick);
    this._scheduledThrough = windowEnd;

    // Auto-stop for non-looping scores once the window passes the last note.
    if (
      !this._loop &&
      !this._endScheduled &&
      this._totalTicks > 0 &&
      toTick >= this._totalTicks
    ) {
      this._endScheduled = true;
      const endAudioTime = this._clock.tickToAudioTime(this._totalTicks);
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
    // ---- Track notes ----
    for (let trackIndex = 0; trackIndex < this._tracks.length; trackIndex++) {
      const track = this._tracks[trackIndex];
      for (let noteIndex = 0; noteIndex < track.notes.length; noteIndex++) {
        const note = track.notes[noteIndex];
        const noteTick = parseTicks(note.at, this._ppq, this._timeSignature);
        if (noteTick < fromTick || noteTick >= toTick) continue;

        const audioTime = this._clock.tickToAudioTime(noteTick);
        const durationSec =
          note.duration !== undefined
            ? this._clock.tickDuration(
                parseTicks(note.duration, this._ppq, this._timeSignature)
              )
            : undefined;

        const timingOffset = this._humanize.timing
          ? (Math.random() * 2 - 1) * this._humanize.timing / 1000
          : 0;
        const velocityOffset = this._humanize.velocity
          ? Math.round((Math.random() * 2 - 1) * this._humanize.velocity)
          : 0;

        const noteId = note.id ?? noteIndex;
        const noteEvent: SequencerNoteEvent = { noteId, trackIndex, noteIndex, note };

        const result = track.instrument.start({
          note: note.note,
          time: Math.max(0, audioTime + timingOffset),
          duration: durationSec,
          velocity: (note.velocity ?? 100) + velocityOffset,
          noteId,
          onStart: () => this._emit("noteOn", noteEvent),
          onEnded: () => {
            this._activeVoices.delete(noteId);
            this._emit("noteOff", noteEvent);
          },
        });

        // Capture the stop function if the instrument returns one
        if (typeof result === "function") {
          this._activeVoices.set(noteId, result as StopFn);
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
  }

  // ---------------------------------------------------------------------------
  // Private — beat / bar events
  // ---------------------------------------------------------------------------

  private _emitBeatsInWindow(fromTick: number, toTick: number): void {
    const beatTicks = this._ppq;
    const barTicks = this._ppq * this._timeSignature;

    // Small tolerance so floating-point drift doesn't skip a beat at tick=0.
    const firstBeat =
      Math.ceil((fromTick - 0.001) / beatTicks) * beatTicks;

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
    const eventName = state === "playing" ? "start" : state === "paused" ? "pause" : "stop";
    this._emit(eventName);
    this._emit("statechange", state);
  }

  /** Recompute _totalTicks from all track notes (at + duration). */
  private _recomputeTotalTicks(): void {
    let max = 0;
    for (const track of this._tracks) {
      for (const note of track.notes) {
        const atTick = parseTicks(note.at, this._ppq, this._timeSignature);
        const durTick =
          note.duration !== undefined
            ? parseTicks(note.duration, this._ppq, this._timeSignature)
            : 0;
        max = Math.max(max, atTick + durTick);
      }
    }
    this._totalTicks = max;
  }

  /** Format a raw tick count as "bar:beat:tick" (all 1-indexed). */
  private _tickToPosition(tick: number): string {
    const barTicks = this._ppq * this._timeSignature;
    const bar = Math.floor(tick / barTicks) + 1;
    const ticksInBar = tick % barTicks;
    const beat = Math.floor(ticksInBar / this._ppq) + 1;
    const ticksInBeat = Math.round(ticksInBar % this._ppq);
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
        const steps = Math.ceil(
          (fromTick - rep.startTick) / rep.intervalTicks
        );
        rep.nextTick = rep.startTick + steps * rep.intervalTicks;
      }
    }
  }
}
