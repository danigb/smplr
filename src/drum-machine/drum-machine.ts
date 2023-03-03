import { Sampler, SamplerAudioLoader } from "../sampler";
import { loadAudioBuffer } from "../sampler/audio-buffers";
import {
  DrumMachineInstrument,
  EMPTY_INSTRUMENT,
  fetchDrumMachineInstrument,
} from "./dm-instrument";

export const DrumMachineInstruments: Record<
  string,
  { name: string; url: string }
> = {
  "TR-808": {
    name: "TR-808",
    url: "https://danigb.github.io/samples/drum-machines/TR-808/dm.json",
  },
};

export type DrumMachineConfig = {
  format: "ogg" | "m4a";
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
    options: Partial<DrumMachineConfig>
  ) {
    const kit = DrumMachineInstruments[options.instrument ?? "TR-808"];
    if (!kit) throw new Error("Invalid instrument: " + options.instrument);
    const instrument = fetchDrumMachineInstrument(kit.url);
    super(context, {
      ...options,
      buffers: drumMachineLoader(instrument, options.format ?? "ogg"),
      noteToSample: (note, buffers, config) => {
        const sample = this.#instrument.nameToSample[note.note];
        return [sample ?? "", 0];
      },
    });
    instrument.then((instrument) => {
      console.log({ instrument });
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
  instrument: Promise<DrumMachineInstrument>,
  format: string
): SamplerAudioLoader {
  return async (context, buffers) => {
    const dm = await instrument;
    await Promise.all(
      dm.samples.map(async (sample) => {
        const url = `${dm.baseUrl}/${sample}.${format}`;
        const buffer = await loadAudioBuffer(context, url);
        if (buffer) buffers[sample] = buffer;
      })
    );
  };
}
