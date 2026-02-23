/**
 * Parse a musical time value to ticks.
 *
 * Supported formats:
 *   "4n"       — quarter note    (4 * ppq / 4 = ppq ticks)
 *   "8n"       — eighth note     (4 * ppq / 8 = ppq/2 ticks)
 *   "16n"      — sixteenth note
 *   "2n"       — half note
 *   "1n"       — whole note      (4 * ppq ticks)
 *   "4n."      — dotted quarter  (ppq * 1.5 ticks)
 *   "1m"       — one measure     (ppq * timeSignature ticks)
 *   "2m"       — two measures
 *   "1:1"      — bar 1, beat 1   (0 ticks; 1-indexed)
 *   "2:1"      — bar 2, beat 1   (1 measure in)
 *   "1:2"      — bar 1, beat 2   (ppq ticks in)
 *   "1:1:48"   — bar 1, beat 1, +48 raw ticks
 *   "1:1.5"    — bar 1, beat 1.5 (fractional beat)
 *   0, 96, 384 — number passthrough (already in ticks)
 */
export function parseTicks(
  time: string | number,
  ppq: number,
  timeSignature: number
): number {
  if (typeof time === "number") return time;

  const t = time.trim();

  // Bare number string: "0", "96", "384.5"
  if (/^\d+(\.\d+)?$/.test(t)) {
    return parseFloat(t);
  }

  // Measure: "1m", "2m", "0.5m"
  const measureMatch = /^(\d+(?:\.\d+)?)m$/.exec(t);
  if (measureMatch) {
    return parseFloat(measureMatch[1]) * ppq * timeSignature;
  }

  // Note value: "4n", "8n", "4n." (dotted)
  // Formula: ticks = (4 * ppq) / denominator
  const noteMatch = /^(\d+(?:\.\d+)?)n(\.?)$/.exec(t);
  if (noteMatch) {
    const denominator = parseFloat(noteMatch[1]);
    const dotted = noteMatch[2] === ".";
    let ticks = (4 * ppq) / denominator;
    if (dotted) ticks *= 1.5;
    return ticks;
  }

  // Position: "bar:beat" or "bar:beat:tick" (all 1-indexed, can be fractional)
  const posMatch = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)(?::(\d+(?:\.\d+)?))?$/.exec(t);
  if (posMatch) {
    const bar = parseFloat(posMatch[1]);
    const beat = parseFloat(posMatch[2]);
    const tick = posMatch[3] ? parseFloat(posMatch[3]) : 0;
    return (bar - 1) * ppq * timeSignature + (beat - 1) * ppq + tick;
  }

  throw new Error(`parseTicks: cannot parse "${time}"`);
}
