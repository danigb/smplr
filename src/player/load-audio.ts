import { Storage } from "../storage";

export type AudioBuffers = Record<string | number, AudioBuffer | undefined>;

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

export function findFirstSupportedFormat(formats: string[]): string | null {
  if (typeof document === "undefined") return null;

  const audio = document.createElement("audio");
  for (let i = 0; i < formats.length; i++) {
    const format = formats[i];
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
