function noteNameToMidi(note: string): number | undefined {
  const REGEX = /^([a-gA-G]?)(#{1,}|b{1,}|)(-?\d+)$/;
  const m = REGEX.exec(note);
  if (!m) return;
  const letter = m[1].toUpperCase();
  if (!letter) return;

  const acc = m[2];
  const alt = acc[0] === "b" ? -acc.length : acc.length;
  const oct = m[3] ? +m[3] : 4;

  const step = (letter.charCodeAt(0) + 3) % 7;
  return [0, 2, 4, 5, 7, 9, 11][step] + alt + 12 * (oct + 1);
}

export function toMidi(note: string | number | undefined): number | undefined {
  return note === undefined
    ? undefined
    : typeof note === "number"
    ? note
    : noteNameToMidi(note);
}

export function findNearestMidi(
  midi: number,
  isAvailable: Record<string | number, unknown>
): [number, number] {
  let i = 0;
  while (isAvailable[midi + i] === undefined && i < 128) {
    if (i > 0) i = -i;
    else i = -i + 1;
  }

  return i === 127 ? [midi, 0] : [midi + i, -i * 100];
}
