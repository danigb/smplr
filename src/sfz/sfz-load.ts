import {
  AudioBuffers,
  findFirstSupportedFormat,
  loadAudioBuffer,
} from "../player/load-audio";
import { Storage } from "../storage";
import { SfzInstrument } from "./sfz-kits";
import { Websfz, WebsfzGroup } from "./websfz";

export async function loadSfzBuffers(
  context: AudioContext,
  buffers: AudioBuffers,
  websfz: Websfz,
  storage: Storage
) {
  websfz.groups.forEach((group) => {
    const urls = getWebsfzGroupUrls(websfz, group);
    return loadAudioBuffers(context, buffers, urls, storage);
  });
}

export async function SfzInstrumentLoader(
  instrument: string | Websfz | SfzInstrument,
  storage: Storage
): Promise<Websfz> {
  const isWebsfz = (inst: any): inst is Websfz => "global" in inst;
  const isSfzInstrument = (inst: any): inst is SfzInstrument =>
    "websfzUrl" in inst;

  if (typeof instrument === "string") {
    return fetchWebSfz(instrument, storage);
  } else if (isWebsfz(instrument)) {
    return instrument;
  } else if (isSfzInstrument(instrument)) {
    const websfz = await fetchWebSfz(instrument.websfzUrl, storage);
    websfz.meta ??= {};
    if (instrument.name) websfz.meta.name = instrument.name;
    if (instrument.baseUrl) websfz.meta.baseUrl = instrument.baseUrl;
    if (instrument.formats) websfz.meta.formats = instrument.formats;
    return websfz;
  } else {
    throw new Error("Invalid instrument: " + JSON.stringify(instrument));
  }
}

// @private
async function loadAudioBuffers(
  context: AudioContext,
  buffers: AudioBuffers,
  urls: Record<string, string>,
  storage: Storage
) {
  await Promise.all(
    Object.keys(urls).map(async (sampleId) => {
      if (buffers[sampleId]) return;

      const buffer = await loadAudioBuffer(context, urls[sampleId], storage);
      if (buffer) buffers[sampleId] = buffer;
      return buffers;
    })
  );
}

// @private
async function fetchWebSfz(url: string, storage: Storage): Promise<Websfz> {
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
export function getWebsfzGroupUrls(websfz: Websfz, group: WebsfzGroup) {
  const urls: Record<string, string> = {};
  const baseUrl = websfz.meta.baseUrl ?? "";
  const format = findFirstSupportedFormat(websfz.meta.formats ?? []) ?? "ogg";

  const prefix = websfz.global["default_path"] ?? "";

  if (!group) return urls;

  return group.regions.reduce((urls, region) => {
    if (region.sample) {
      urls[region.sample] = `${baseUrl}/${prefix}${region.sample}.${format}`;
    }
    return urls;
  }, urls);
}
