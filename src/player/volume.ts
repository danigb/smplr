/// This is how the MIDI association converts midi velocity [0..127] into gain [0..1]
/// @see https://www.midi.org/specifications/file-format-specifications/dls-downloadable-sounds/dls-level-1
export function midiVelToGain(vel: number) {
  return (vel * vel) / 16129; // 16129 = 127 * 127
}

export function dbToGain(decibels: number) {
  return Math.pow(10, decibels / 20);
}
