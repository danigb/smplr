import { Storage } from "../storage";

export function isDrumMachineInstrument(
  instrument: any
): instrument is DrumMachineInstrument {
  return (
    typeof instrument === "object" &&
    typeof instrument.baseUrl === "string" &&
    typeof instrument.name === "string" &&
    Array.isArray(instrument.samples) &&
    Array.isArray(instrument.groupNames) &&
    typeof instrument.nameToSampleName === "object" &&
    typeof instrument.sampleGroupVariations === "object"
  );
}

export type DrumMachineInstrument = {
  baseUrl: string;
  name: string;
  samples: string[];
  groupNames: string[];
  nameToSampleName: Record<string, string | undefined>;
  sampleGroupVariations: Record<string, string[]>;
};
export const EMPTY_INSTRUMENT: DrumMachineInstrument = {
  baseUrl: "",
  name: "",
  samples: [],
  groupNames: [],
  nameToSampleName: {},
  sampleGroupVariations: {},
};

export async function fetchDrumMachineInstrument(
  url: string,
  storage: Storage
): Promise<DrumMachineInstrument> {
  const res = await storage.fetch(url);
  const json = await res.json();
  // need to fix json
  json.baseUrl = url.replace("/dm.json", "");
  json.groupNames = [];
  json.nameToSampleName = {};
  json.sampleGroupVariations = {};
  for (const sample of json.samples) {
    json.nameToSampleName[sample] = sample;
    const separator = sample.indexOf("/") !== -1 ? "/" : "-";
    const [base, variation] = sample.split(separator);
    if (!json.groupNames.includes(base)) {
      json.groupNames.push(base);
    }
    json.nameToSampleName[base] ??= sample;
    json.sampleGroupVariations[base] ??= [];
    if (variation) {
      json.sampleGroupVariations[base].push(`${base}${separator}${variation}`);
    }
  }

  return json;
}
