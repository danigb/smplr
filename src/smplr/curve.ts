/**
 * A mapping from 0..1 to 0..1. It is either a preset name or a list of `[x, y]`
 * breakpoints.
 *
 * Breakpoints are sorted by x and interpolated linearly. Below the first point and above
 * the last one the curve is flat.
 *
 * Presets:
 * - `"linear"` is the identity.
 * - `"soft"` (`x^0.6`) gives more output for a light touch.
 * - `"hard"` (`x^1.6`) needs a heavier touch.
 */
export type Curve = "linear" | "soft" | "hard" | [number, number][];

const PRESET_EXPONENTS: Record<string, number> = {
  linear: 1,
  soft: 0.6,
  hard: 1.6,
};

/** Evaluate `curve` at `x`, which is clamped to 0..1. */
export function evalCurve(curve: Curve, x: number): number {
  const v = Math.min(1, Math.max(0, x));
  if (typeof curve === "string") {
    const exp = PRESET_EXPONENTS[curve];
    return exp === undefined ? v : Math.pow(v, exp);
  }
  if (curve.length === 0) return v;
  const points = isSorted(curve)
    ? curve
    : [...curve].sort((a, b) => a[0] - b[0]);
  if (v <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (v <= x1) {
      const [x0, y0] = points[i - 1];
      return x1 === x0 ? y1 : y0 + ((v - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

function isSorted(points: [number, number][]): boolean {
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] < points[i - 1][0]) return false;
  }
  return true;
}
