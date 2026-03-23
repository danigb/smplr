/**
 * Trim trailing silence from an AudioBuffer.
 *
 * Scans all channels from the end to find the last sample above the threshold,
 * then returns a new AudioBuffer trimmed to that length.
 */

const SILENCE_THRESHOLD = 1e-4; // ~-80dB

export function trimSilence(buffer: AudioBuffer): AudioBuffer {
  const { numberOfChannels, sampleRate, length } = buffer;

  // Find the last non-silent sample across all channels
  let lastNonSilent = 0;
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = length - 1; i >= 0; i--) {
      if (Math.abs(data[i]) > SILENCE_THRESHOLD) {
        if (i > lastNonSilent) lastNonSilent = i;
        break;
      }
    }
  }

  // Keep at least 1 sample
  const trimmedLength = Math.max(1, lastNonSilent + 1);

  if (trimmedLength === length) return buffer;

  // Create a new trimmed buffer
  // Note: OfflineAudioContext is not available here, so we use the constructor
  const trimmed = new AudioBuffer({
    numberOfChannels,
    length: trimmedLength,
    sampleRate,
  });

  for (let ch = 0; ch < numberOfChannels; ch++) {
    const source = buffer.getChannelData(ch);
    trimmed.copyToChannel(source.subarray(0, trimmedLength), ch);
  }

  return trimmed;
}
