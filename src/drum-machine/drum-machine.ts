import {
  findFirstSupportedFormat,
  loadAudioBuffer,
} from "../sampler/load-audio";
import { Sampler, SamplerAudioLoader } from "../sampler/sampler";
import {
  DrumMachineInstrument,
  EMPTY_INSTRUMENT,
  fetchDrumMachineInstrument,
} from "./dm-instrument";

export function getDrumMachineNames() {
  return Object.keys(INSTRUMENTS);
}

const INSTRUMENTS: Record<string, string> = {
  "TR-808": "https://danigb.github.io/samples/drum-machines/TR-808/dm.json",
  "Casio-RZ1":
    "https://danigb.github.io/samples/drum-machines/Casio-RZ1/dm.json",
  "LM-2": "https://danigb.github.io/samples/drum-machines/LM-2/dm.json",
  "MFB-512": "https://danigb.github.io/samples/drum-machines/MFB-512/dm.json",
  "Roland CR-8000":
    "https://danigb.github.io/samples/drum-machines/Roland-CR-8000/dm.json",
};

export type DrumMachineConfig = {
  instrument: string;
  destination: AudioNode;

  detune: number;
  volume: number;
  velocity: number;
  decayTime?: number;
  lpfCutoffHz?: number;
};

export class DrumMachine extends Sampler {
  #instrument = EMPTY_INSTRUMENT;
  public constructor(
    context: AudioContext,
    options: Partial<DrumMachineConfig> = {}
  ) {
    const url = INSTRUMENTS[options.instrument ?? "TR-808"];
    if (!url) throw new Error("Invalid instrument: " + options.instrument);
    const instrument = fetchDrumMachineInstrument(url);

    super(context, {
      ...options,
      buffers: drumMachineLoader(instrument),
      noteToSample: (note, buffers, config) => {
        const sample = this.#instrument.nameToSample[note.note];
        return [sample ?? "", 0];
      },
    });
    instrument.then((instrument) => {
      this.#instrument = instrument;
    });
  }

  get sampleNames(): string[] {
    return this.#instrument.sampleNames;
  }

  getVariations(name: string): string[] {
    return this.#instrument.sampleNameVariations[name] ?? [];
  }
}

function drumMachineLoader(
  instrument: Promise<DrumMachineInstrument>
): SamplerAudioLoader {
  const format = findFirstSupportedFormat(["ogg", "m4a"]) ?? "ogg";
  return async (context, buffers) => {
    const dm = await instrument;
    await Promise.all(
      dm.samples.map(async (sample) => {
        const url = `${dm.baseUrl}/${sample}.${format}`;
        const sampleName =
          sample.indexOf("/") !== -1 ? sample : sample.replace("-", "/");
        const buffer = await loadAudioBuffer(context, url);
        if (buffer) buffers[sampleName] = buffer;
      })
    );
  };
}
