/**
 * TransportClock
 *
 * Converts between musical ticks and AudioContext time with support for:
 *   - BPM changes mid-playback (via checkpoints)
 *   - Pause / resume
 *   - Seek to arbitrary tick position
 *   - Loop restart (seekAt a future audio time)
 *
 * All time values are in AudioContext seconds (context.currentTime).
 * Ticks are the internal unit: ppq ticks per quarter note.
 *
 * Principle: a Checkpoint records that at a specific audio time, a specific
 * tick position was reached at a specific BPM. Checkpoints are always ordered
 * by audioTime. The conversion functions find the last checkpoint whose
 * audioTime (or tick) is <= the query value and interpolate from there.
 */

export type TransportState = "stopped" | "playing" | "paused";

type Checkpoint = {
  /** Musical tick at this anchor point. */
  tick: number;
  /** AudioContext time (seconds) at this anchor point. */
  audioTime: number;
  /** BPM in effect from this checkpoint forward. */
  bpm: number;
};

export type TransportClockOptions = {
  bpm?: number;
  ppq?: number;
  timeSignature?: number;
};

export class TransportClock {
  private readonly _context: BaseAudioContext;

  private _bpm: number;
  readonly ppq: number;
  private _timeSignature: number;

  private _state: TransportState = "stopped";
  private _checkpoints: Checkpoint[] = [];
  private _pausedAtTick = 0;

  constructor(context: BaseAudioContext, options: TransportClockOptions = {}) {
    this._context = context;
    this._bpm = options.bpm ?? 120;
    this.ppq = options.ppq ?? 480;
    this._timeSignature = options.timeSignature ?? 4;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  get state(): TransportState {
    return this._state;
  }

  // ---------------------------------------------------------------------------
  // BPM / time signature
  // ---------------------------------------------------------------------------

  get bpm(): number {
    return this._bpm;
  }

  /**
   * Set BPM. If currently playing, inserts a new checkpoint at the current
   * audio time so that all future tick↔time conversions use the new tempo,
   * while already-converted past events remain unaffected.
   */
  set bpm(value: number) {
    if (this._state === "playing") {
      const now = this._context.currentTime;
      const tick = this.audioTimeToTick(now);
      this._checkpoints.push({ tick, audioTime: now, bpm: value });
    }
    this._bpm = value;
  }

  get timeSignature(): number {
    return this._timeSignature;
  }

  set timeSignature(value: number) {
    this._timeSignature = value;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start playback. Records a checkpoint at the current audio time.
   * @param offsetTick  Musical tick to start from (default 0).
   */
  start(offsetTick = 0): void {
    const audioTime = this._context.currentTime;
    this._checkpoints = [{ tick: offsetTick, audioTime, bpm: this._bpm }];
    this._state = "playing";
  }

  /**
   * Pause playback. Saves the current tick position so resume can start from
   * the same place.
   */
  pause(): void {
    if (this._state !== "playing") return;
    this._pausedAtTick = this.currentTick;
    this._state = "paused";
  }

  /**
   * Resume from paused. Creates a new checkpoint at the current audio time
   * anchored to the saved tick position.
   */
  resume(): void {
    if (this._state !== "paused") return;
    const audioTime = this._context.currentTime;
    this._checkpoints = [{ tick: this._pausedAtTick, audioTime, bpm: this._bpm }];
    this._state = "playing";
  }

  /**
   * Stop playback and reset position to 0.
   */
  stop(): void {
    this._checkpoints = [];
    this._pausedAtTick = 0;
    this._state = "stopped";
  }

  // ---------------------------------------------------------------------------
  // Seek
  // ---------------------------------------------------------------------------

  /**
   * Seek to a tick position immediately (at context.currentTime).
   * Replaces all checkpoints with a single new one.
   * Works while playing or paused.
   */
  seek(tick: number): void {
    if (this._state === "playing") {
      const audioTime = this._context.currentTime;
      this._checkpoints = [{ tick, audioTime, bpm: this._bpm }];
    } else {
      this._pausedAtTick = tick;
    }
  }

  /**
   * Re-anchor: at a specific future audio time, the tick position will jump to
   * `tick`. Used for sample-accurate loop restarts.
   *
   * Any checkpoints at or after `audioTime` are removed and replaced with this
   * new anchor, preserving the BPM that was in effect at that time.
   */
  seekAt(tick: number, audioTime: number): void {
    // Find the BPM that will be in effect at audioTime
    let bpm = this._bpm;
    for (const cp of this._checkpoints) {
      if (cp.audioTime <= audioTime) bpm = cp.bpm;
    }
    this._checkpoints = this._checkpoints.filter((cp) => cp.audioTime < audioTime);
    this._checkpoints.push({ tick, audioTime, bpm });
  }

  // ---------------------------------------------------------------------------
  // Position
  // ---------------------------------------------------------------------------

  /**
   * Current tick position.
   * - While playing: derived from context.currentTime.
   * - While paused or stopped: the saved tick position.
   */
  get currentTick(): number {
    if (this._state === "playing") {
      return this.audioTimeToTick(this._context.currentTime);
    }
    return this._pausedAtTick;
  }

  // ---------------------------------------------------------------------------
  // Time conversion
  // ---------------------------------------------------------------------------

  /**
   * Convert a tick position to an AudioContext time (seconds).
   *
   * Finds the most recent checkpoint (by audioTime) whose tick <= the target
   * tick, then interpolates forward using that checkpoint's BPM.
   *
   * This correctly handles loop restarts: after `seekAt(0, T)`, a new
   * checkpoint with tick=0 is added, so tick=100 in the new iteration maps
   * to T + 100*spt instead of the first-iteration value.
   */
  tickToAudioTime(tick: number): number {
    const cp = this._findCheckpointForTick(tick);
    return cp.audioTime + (tick - cp.tick) * this._secondsPerTick(cp.bpm);
  }

  /**
   * Convert an AudioContext time (seconds) to a tick position.
   *
   * Finds the most recent checkpoint (by audioTime) whose audioTime <= the
   * target time, then interpolates forward.
   */
  audioTimeToTick(audioTime: number): number {
    const cp = this._findCheckpointForAudioTime(audioTime);
    return cp.tick + (audioTime - cp.audioTime) / this._secondsPerTick(cp.bpm);
  }

  /**
   * Duration in seconds for a given number of ticks at the current BPM.
   */
  tickDuration(ticks: number): number {
    return ticks * this._secondsPerTick(this._bpm);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _secondsPerTick(bpm: number): number {
    return 60 / (bpm * this.ppq);
  }

  /**
   * Find the most recent checkpoint (latest audioTime) whose tick <= targetTick.
   * Falls back to a virtual origin checkpoint if none match.
   */
  private _findCheckpointForTick(targetTick: number): Checkpoint {
    let best: Checkpoint | null = null;
    for (const cp of this._checkpoints) {
      if (cp.tick <= targetTick) {
        best = cp;
        // Keep iterating: checkpoints are audioTime-ordered, so later ones
        // with tick <= targetTick are more recent and should win.
      }
    }
    return best ?? this._origin();
  }

  /**
   * Find the most recent checkpoint whose audioTime <= targetTime.
   * Falls back to a virtual origin checkpoint if none match.
   */
  private _findCheckpointForAudioTime(targetTime: number): Checkpoint {
    let best: Checkpoint | null = null;
    for (const cp of this._checkpoints) {
      if (cp.audioTime <= targetTime) {
        best = cp;
      }
    }
    return best ?? this._origin();
  }

  /** Virtual origin used before start() is called. */
  private _origin(): Checkpoint {
    return { tick: 0, audioTime: 0, bpm: this._bpm };
  }
}
