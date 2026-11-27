/** Smallest value an exponential ramp may target (-100 dB as a gain). */
export const MIN_RAMP_VALUE = 1e-5;

/**
 * Chained exponential ramps on one AudioParam whose intrinsic value nothing else
 * automates.
 *
 * It remembers the last scheduled segment, so a new ramp starts from the exact value the
 * param has at its start time. This avoids `cancelAndHoldAtTime`, which Firefox lacks.
 *
 * Values are clamped to {@link MIN_RAMP_VALUE}, because exponential ramps cannot reach 0.
 * Ramps are scheduled forward only: a ramp requested before the previous one's start time
 * is moved to that start time.
 */
export class ParamRamp {
  readonly base: number;
  #param: AudioParam;
  #seg: { v0: number; t0: number; v1: number; t1: number } | undefined;

  constructor(param: AudioParam, base: number) {
    this.#param = param;
    this.base = base;
  }

  /** The value at `t` given what this helper scheduled (`base` before any ramp). */
  valueAt(t: number): number {
    const s = this.#seg;
    if (!s) return this.base;
    if (t <= s.t0) return s.v0;
    if (t >= s.t1) return s.v1;
    return s.v0 * Math.pow(s.v1 / s.v0, (t - s.t0) / (s.t1 - s.t0));
  }

  /**
   * Ramp exponentially to `target`, reaching it `duration` seconds after `time`.
   * A duration of 0 or less sets the value at `time`.
   */
  rampTo(target: number, duration: number, time: number): void {
    const t0 = this.#seg ? Math.max(time, this.#seg.t0) : time;
    const v0 = Math.max(MIN_RAMP_VALUE, this.valueAt(t0));
    const v1 = Math.max(MIN_RAMP_VALUE, target);
    const t1 = t0 + Math.max(0, duration);
    const p = this.#param;
    p.cancelScheduledValues(t0);
    if (t1 > t0) {
      p.setValueAtTime(v0, t0);
      p.exponentialRampToValueAtTime(v1, t1);
      this.#seg = { v0, t0, v1, t1 };
    } else {
      p.setValueAtTime(v1, t0);
      this.#seg = { v0: v1, t0, v1, t1 };
    }
  }
}
