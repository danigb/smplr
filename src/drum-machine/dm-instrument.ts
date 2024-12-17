import { Storage } from "../storage";

export function isDrumMachineInstrument(
  instrument: any
): instrument is DrumMachineInstrument {
  return (
    typeof instrument === "object" &&
    typeof instrument.baseUrl === "string" &&
    typeof instrument.name === "string" &&
    Array.isArray(instrument.samples) &&
    Array.isArray(instrument.sampleNames) &&
    typeof instrument.nameToSample === "object" &&
    typeof instrument.sampleNameVariations === "object"
  );
}

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
  for (const sample of json.samples) {
    json.nameToSample[sample] = sample;
    const separator = sample.indexOf("/") !== -1 ? "/" : "-";
    const [base, variation] = sample.split(separator);
    if (!json.sampleNames.includes(base)) {
      json.sampleNames.push(base);
    }
    json.nameToSample[base] ??= sample;
    json.sampleNameVariations[base] ??= [];
    if (variation) {
      json.sampleNameVariations[base].push(`${base}${separator}${variation}`);
    }
  }

  return json;
}
