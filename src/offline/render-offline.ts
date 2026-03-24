import { RenderResult } from "./render-result";
import { trimSilence } from "./trim-silence";

export type { RenderResult };

export interface RenderOfflineOptions {
  /** Total duration in seconds. When omitted, uses 60s max and trims trailing silence. */
  duration?: number;
  /** Sample rate. Default: 48000. */
  sampleRate?: number;
  /** Number of output channels. Default: 2 (stereo). */
  channels?: number;
}

const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_CHANNELS = 2;
const DEFAULT_MAX_DURATION = 60;

/**
 * Render audio offline using an OfflineAudioContext.
 *
 * The callback receives an OfflineAudioContext. Create instruments,
 * schedule notes using absolute times (starting from 0), then return.
 * The audio is rendered as fast as possible (not real-time).
 *
 * Returns a RenderResult with the rendered AudioBuffer and
 * convenience methods for WAV encoding and download.
 *
 * @example
 * ```ts
 * const result = await renderOffline(async (context) => {
 *   const piano = SplendidGrandPiano(context);
 *   await piano.ready;
 *   piano.start({ note: "C4", time: 0, duration: 1 });
 * });
 * result.downloadWav("export.wav");
 * ```
 */
export async function renderOffline(
  callback: (context: OfflineAudioContext) => Promise<void>,
  options?: RenderOfflineOptions
): Promise<RenderResult> {
  const sampleRate = options?.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const channels = options?.channels ?? DEFAULT_CHANNELS;
  const explicitDuration = options?.duration;
  const duration = explicitDuration ?? DEFAULT_MAX_DURATION;
  const length = Math.ceil(duration * sampleRate);

  const offlineContext = new OfflineAudioContext(channels, length, sampleRate);

  await callback(offlineContext);

  let buffer = await offlineContext.startRendering();

  // Auto-trim trailing silence when duration was not explicitly provided
  if (explicitDuration === undefined) {
    buffer = trimSilence(buffer);
  }

  return new RenderResult(buffer);
}
