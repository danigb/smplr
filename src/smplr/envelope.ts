/**
 * Generic delay -> attack -> hold -> decay -> sustain envelope math, shared by the amplitude
 * envelope (voice's own gain) and the modulation envelope (a second, independent instance of the
 * same shape used to modulate pitch/filter cutoff over time - see SF2's "mod envelope").
 */

export type AdsrParams = {
  delay: number; // seconds of silence/0 before attack starts
  attack: number; // seconds to ramp 0 -> 1
  hold: number; // seconds held flat at 1 after attack, before decay starts
  decay: number; // seconds for a *full* (100%) decay from 1 to 0 - see computeAdsrTimes
  sustain: number; // level held after decay, until release (0-1)
};

/** absolute AudioContext times for each phase boundary, plus the resolved sustain level */
export type AdsrTimes = {
  delayEnd: number;
  attackEnd: number;
  holdEnd: number;
  decayEnd: number;
  sustainLevel: number;
};

/**
 * resolves phase boundaries as absolute AudioContext times
 */
export function computeAdsrTimes(
  startAt: number,
  params: AdsrParams,
): AdsrTimes {
  const delayEnd = startAt + params.delay;
  const attackEnd = delayEnd + params.attack;
  const holdEnd = attackEnd + params.hold;
  const decayToSustainSeconds = params.decay * (1 - params.sustain);
  const decayEnd = holdEnd + decayToSustainSeconds;
  return {
    delayEnd,
    attackEnd,
    holdEnd,
    decayEnd,
    sustainLevel: params.sustain,
  };
}

/**
 * whether this envelope actually shapes anything
 */
export function hasAdsrShape(startAt: number, times: AdsrTimes): boolean {
  return (
    times.delayEnd > startAt ||
    times.attackEnd > times.delayEnd ||
    times.holdEnd > times.attackEnd ||
    times.sustainLevel !== 1
  );
}

/**
 * How an envelope value (0-1) maps onto a destination AudioParam's own units, and how the
 * param should ramp between phase boundaries. Defaults to identity + linear (a plain gain).
 * E.g. a filter cutoff in Hz follows an envelope that is linear in *cents*, which is exactly an
 * exponential ramp in Hz - so scheduling it directly is exact and needs no extra audio nodes.
 */
export type EnvelopeMapping = {
  toValue: (envelope: number) => number;
  ramp: "linear" | "exponential";
};

const IDENTITY: EnvelopeMapping = { toValue: (v) => v, ramp: "linear" };

function rampTo(
  param: AudioParam,
  mapping: EnvelopeMapping,
  value: number,
  time: number,
): void {
  if (mapping.ramp === "exponential") {
    param.exponentialRampToValueAtTime(value, time);
  } else {
    param.linearRampToValueAtTime(value, time);
  }
}

/** schedules delay/attack/hold/decay/sustain shape onto `param`, starting at `startAt` */
export function scheduleAdsr(
  param: AudioParam,
  startAt: number,
  times: AdsrTimes,
  mapping: EnvelopeMapping = IDENTITY,
): void {
  const v = mapping.toValue;
  param.setValueAtTime(v(0), startAt);
  param.setValueAtTime(v(0), times.delayEnd);
  rampTo(param, mapping, v(1), times.attackEnd);
  param.setValueAtTime(v(1), times.holdEnd);
  rampTo(param, mapping, v(times.sustainLevel), times.decayEnd);
}

/** the envelope's value at AudioContext time `t`, whichever phase it falls in */
export function adsrValueAt(times: AdsrTimes, t: number): number {
  if (t <= times.delayEnd) return 0;
  if (t <= times.attackEnd) {
    return times.attackEnd > times.delayEnd
      ? (t - times.delayEnd) / (times.attackEnd - times.delayEnd)
      : 1;
  }
  if (t <= times.holdEnd) return 1;
  if (t <= times.decayEnd) {
    return times.decayEnd > times.holdEnd
      ? 1 +
          (times.sustainLevel - 1) *
            ((t - times.holdEnd) / (times.decayEnd - times.holdEnd))
      : times.sustainLevel;
  }
  return times.sustainLevel;
}

/**
 * schedules release ramp on `param`, starting from wherever the envelope actually was at time
 * `t` - so a note stopped mid-attack/mid-decay fades smoothly. Returns the time the ramp
 * reaches the envelope's resting value (`t + releaseSeconds`)
 */
export function scheduleAdsrRelease(
  param: AudioParam,
  times: AdsrTimes,
  t: number,
  releaseSeconds: number,
  mapping: EnvelopeMapping = IDENTITY,
): number {
  const valueAtT = mapping.toValue(adsrValueAt(times, t));
  const stopAt = t + releaseSeconds;
  /** 
   * cancelScheduledValues(t) drops the attack/decay ramp that ends after `t`. Without a
   * replacement, a release scheduled ahead of time would hold the previous value until `t` and
   * then jump. Ramping to valueAtT keeps the curve up to `t`.
   */
  param.cancelScheduledValues(t);
  rampTo(param, mapping, valueAtT, t);
  rampTo(param, mapping, mapping.toValue(0), stopAt);
  return stopAt;
}
