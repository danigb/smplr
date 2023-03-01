function noteNameToMidi(note: string): number | undefined {
  const REGEX = /^([a-gA-G]?)(#{1,}|b{1,}|)(-?\d+)$/;
  const m = REGEX.exec(note) as string[];
  const letter = m[1].toUpperCase();
  if (!letter) return;

  const acc = m[2];
  const alt = acc[0] === "b" ? -acc.length : acc.length;
  const oct = m[3] ? +m[3] : 4;

  const step = (letter.charCodeAt(0) + 3) % 7;
  return [0, 2, 4, 5, 7, 9, 11][step] + alt + 12 * (oct + 1);
}

type Note = {
  midi?: number;
  name?: string;
};

export function toMidi(
  note: string | number | Note | undefined
): number | undefined {
  return note === undefined
    ? undefined
    : typeof note === "number"
    ? note
    : typeof note === "string"
    ? noteNameToMidi(note)
    : toMidi(note.midi ?? note.name);
}

/// This is how the MIDI association converts midi velocity [0..127] into gain [0..1]
/// @see https://www.midi.org/specifications/file-format-specifications/dls-downloadable-sounds/dls-level-1
export function midiVelToGain(vel: number) {
  return (vel * vel) / 16129; // 16129 = 127 * 127
}
