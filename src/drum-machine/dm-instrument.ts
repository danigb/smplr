import { Storage } from "../storage";

export type DrumMachineInstrument = {
  baseUrl: string;
  name: string;
  samples: string[];
  sampleNames: string[];
  nameToSample: Record<string, string | undefined>;
  sampleNameVariations: Record<string, string[]>;
};
export const EMPTY_INSTRUMENT: DrumMachineInstrument = {
  baseUrl: "",
  name: "",
  samples: [],
  sampleNames: [],
  nameToSample: {},
  sampleNameVariations: {},
};

export async function fetchDrumMachineInstrument(
  url: string,
  storage: Storage
): Promise<DrumMachineInstrument> {
  const res = await storage.fetch(url);
  const json = await res.json();
  // need to fix json
  json.baseUrl = url.replace("/dm.json", "");
  json.sampleNames = [];
  json.nameToSample = {};
  json.sampleNameVariations = {};
  for (const sampleSrc of json.samples) {
    const sample =
      sampleSrc.indexOf("/") !== -1 ? sampleSrc : sampleSrc.replace("-", "/");
    json.nameToSample[sample] = sample;
    const [base, variation] = sample.split("/");
    if (!json.sampleNames.includes(base)) {
      json.sampleNames.push(base);
    }
    json.nameToSample[base] ??= sample;
    json.sampleNameVariations[base] ??= [];
    if (variation) {
      json.sampleNameVariations[base].push(`${base}/${variation}`);
    }
  }

  return json;
}
