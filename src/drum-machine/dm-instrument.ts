export type DrumMachineInstrument = {
  baseUrl: string;
  name: string;
  samples: string[];
  sampleNames: string[];
  nameToSample: Record<string | number, string | undefined>;
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
  url: string
): Promise<DrumMachineInstrument> {
  const res = await fetch(url);
  const json = await res.json();
  // need to fix json
  json.baseUrl = json.baseUrl.replace("tr-808", "TR-808");
  json.sampleNames = [];
  json.nameToSample = {};
  json.sampleNameVariations = {};
  for (const sample of json.samples) {
    json.nameToSample[sample] = sample;
    const [base, variation] = sample.split("/");
    if (!json.sampleNames.includes(base)) {
      json.sampleNames.push(base);
    }
    json.nameToSample[base] ??= sample;
    json.sampleNameVariations[base] ??= [];
    json.sampleNameVariations[base].push(variation);
  }

  return json;
}
