export type DrumMachineInstrument = {
  baseUrl: string;
  name: string;
  samples: string[];
};
export const EMPTY_INSTRUMENT: DrumMachineInstrument = {
  baseUrl: "",
  name: "",
  samples: [],
};

export function getSampleNames(instrument: DrumMachineInstrument): string[] {
  const names = instrument.samples.map((sample) => sample.split("/")[0]);
  return [...new Set(names)];
}
