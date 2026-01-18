let context: AudioContext | undefined;

export function getAudioContext() {
  context ??= new AudioContext();
  // Resume if suspended (required for iOS)
  if (context.state === "suspended") {
    context.resume();
  }
  return context;
}
