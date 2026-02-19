import { Storage } from "../storage";

export type AudioBuffers = Record<string | number, AudioBuffer | undefined>;

/**
 * A function that downloads audio into a AudioBuffers
 */
export type AudioBuffersLoader = (
  context: BaseAudioContext,
  buffers: AudioBuffers
) => Promise<void>;

export async function loadAudioBuffer(
  context: BaseAudioContext,
  url: string,
  storage: Storage
): Promise<AudioBuffer | undefined> {
  url = url.replace(/#/g, "%23").replace(/([^:]\/)\/+/g, "$1");
  const response = await storage.fetch(url);
  if (response.status !== 200) {
    console.warn(
      "Error loading buffer. Invalid status: ",
      response.status,
      url
    );
    return;
  }
  try {
    const audioData = await response.arrayBuffer();
    const buffer = await context.decodeAudioData(audioData);
    return buffer;
  } catch (error) {
    console.warn("Error loading buffer", error, url);
  }
}

// Safari reports it can play OGG but decodeAudioData fails on many samples
function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Chromium");
}

export function findFirstSupportedFormat(formats: string[]): string | null {
  if (typeof document === "undefined") return null;

  // Safari's decodeAudioData fails on OGG even though canPlayType returns "maybe"
  // Skip OGG entirely on Safari and use the fallback format (mp3/m4a)
  const skipOgg = isSafari();

  const audio = document.createElement("audio");
  for (let i = 0; i < formats.length; i++) {
    const format = formats[i];
    if (skipOgg && format === "ogg") {
      continue;
    }
    const canPlay = audio.canPlayType(`audio/${format}`);
    if (canPlay === "probably" || canPlay === "maybe") {
      return format;
    }
    // check Safari for aac format
    if (format === "m4a") {
      const canPlay = audio.canPlayType(`audio/aac`);
      if (canPlay === "probably" || canPlay === "maybe") {
        return format;
      }
    }
  }
  return null;
}

export function getPreferredAudioExtension() {
  const format = findFirstSupportedFormat(["ogg", "m4a"]) ?? "ogg";
  return "." + format;
}
