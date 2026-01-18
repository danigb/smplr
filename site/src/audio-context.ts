let context: AudioContext | undefined;

// Note: iOS 17 and earlier have audio distortion due to sample rate mismatch bug.
// This is a WebKit bug fixed in iOS 18. No JS workaround exists.
// See: https://bugs.webkit.org/show_bug.cgi?id=154538
export function getAudioContext() {
  context ??= new AudioContext();
  // Resume if suspended (required for iOS)
  if (context.state === "suspended") {
    context.resume();
  }
  return context;
}
