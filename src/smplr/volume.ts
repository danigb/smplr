import { Curve, evalCurve } from "./curve";

/// This is how the MIDI association converts midi velocity [0..127] into gain [0..1]
/// @see https://www.midi.org/specifications/file-format-specifications/dls-downloadable-sounds/dls-level-1
export function midiVelToGain(vel: number) {
  return (vel * vel) / 16129; // 16129 = 127 * 127
}

export function dbToGain(decibels: number) {
  return Math.pow(10, decibels / 20);
}

/** dB span of 20·log10(127): the attenuation at velocity 1 of a linear (v^1) response. */
const DB_PER_EXPONENT = 20 * Math.log10(127);

/** Default `ampVelDb`: the square law `(vel/127)^2`, about 84.15 dB at velocity 1. */
export const DEFAULT_AMP_VEL_DB = 2 * DB_PER_EXPONENT;

export type VelocityGainOptions = {
  /** Depth of velocity's effect on gain, 0..1. 0 means every velocity plays at full gain. */
  track: number;
  /** Attenuation in dB at velocity 1, relative to 127. Sets a power-law response. */
  db: number;
  /** Explicit shape (velocity 0..1 to amplitude 0..1). It replaces `db` when set. */
  curve?: Curve;
};

/**
 * Velocity (0..127) to linear gain.
 *
 * The shape is `c(v) = curve(v)`, or `v^(db / 20·log10 127)` when there is no curve.
 * The result is `(1 - track) + track · c(v)`. With the defaults (track 1, db
 * {@link DEFAULT_AMP_VEL_DB}, no curve) it is exactly {@link midiVelToGain}.
 */
export function velocityToGain(
  vel: number,
  { track, db, curve }: VelocityGainOptions,
): number {
  if (!curve && track === 1 && db === DEFAULT_AMP_VEL_DB) {
    return midiVelToGain(vel);
  }
  const v = Math.min(1, Math.max(0, vel / 127));
  const shape = curve ? evalCurve(curve, v) : Math.pow(v, db / DB_PER_EXPONENT);
  const t = Math.min(1, Math.max(0, track));
  return 1 - t + t * shape;
}
