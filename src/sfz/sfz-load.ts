import { loadAudioBuffer } from "../sampler/audio-buffers";
import { SfzInstrument } from "./sfz-kits";
import { Websfz, WebsfzGroup } from "./websfz";

export type BuffersCache = Record<string, AudioBuffer>;

export async function loadSfzBuffers(
  context: AudioContext,
  buffers: BuffersCache,
  websfz: Websfz
) {
  websfz.groups.forEach((group) => {
    const urls = getWebsfzGroupUrls(websfz, group);
    return loadAudioBuffers(context, buffers, urls);
  });
}

export async function loadSfzInstrument(
  instrument: string | Websfz | SfzInstrument
): Promise<Websfz> {
  const isWebsfz = (inst: any): inst is Websfz => "global" in inst;
  const isSfzInstrument = (inst: any): inst is SfzInstrument =>
    "websfzUrl" in inst;

  if (typeof instrument === "string") {
    return fetchWebSfz(instrument);
  } else if (isWebsfz(instrument)) {
    return instrument;
  } else if (isSfzInstrument(instrument)) {
    const websfz = await fetchWebSfz(instrument.websfzUrl);
    websfz.meta ??= {};
    websfz.meta.name ??= instrument.name;
    websfz.meta.baseUrl ??= instrument.baseUrl;
    websfz.meta.formats ??= instrument.formats;
    return websfz;
  } else {
    throw new Error("Invalid instrument: " + JSON.stringify(instrument));
  }
}

// @private
async function loadAudioBuffers(
  context: AudioContext,
  buffers: BuffersCache,
  urls: Record<string, string>
) {
  await Promise.all(
    Object.keys(urls).map(async (sampleId) => {
      if (buffers[sampleId]) return;

      const buffer = await loadAudioBuffer(context, urls[sampleId]);
      if (buffer) buffers[sampleId] = buffer;
      return buffers;
    })
  );
}

// @private
async function fetchWebSfz(url: string): Promise<Websfz> {
  try {
    const response = await fetch(url);
    const json = await response.json();
    return json as Websfz;
  } catch (error) {
    console.warn(`Can't load SFZ file ${url}`, error);
    throw new Error(`Can't load SFZ file ${url}`);
  }
}

// @private
export function getWebsfzGroupUrls(
  websfz: Websfz,
  group: WebsfzGroup,
  format = ".ogg"
) {
  const urls: Record<string, string> = {};
  const baseUrl = websfz.meta.baseUrl ?? "";

  const prefix = websfz.global["default_path"] ?? "";

  if (!group) return urls;

  return group.regions.reduce((urls, region) => {
    if (region.sample) {
      urls[region.sample] = `${baseUrl}/${prefix}${region.sample}${format}`;
    }
    return urls;
  }, urls);
}
