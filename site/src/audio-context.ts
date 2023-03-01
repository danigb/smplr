let context: AudioContext | undefined;

export function getAudioContext() {
  context ??= new AudioContext();
  return context;
}
