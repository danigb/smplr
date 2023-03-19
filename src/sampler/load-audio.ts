export type AudioBuffers = Record<string | number, AudioBuffer>;

export async function loadAudioBuffer(
  context: BaseAudioContext,
  url: string
): Promise<AudioBuffer | undefined> {
  url = url.replace(/#/g, "%23").replace(/([^:]\/)\/+/g, "$1");
  const response = await fetch(url);
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
