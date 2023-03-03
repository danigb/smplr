import { Sampler, SamplerAudioLoader } from "../sampler";
import { loadAudioBuffer } from "../sampler/audio-buffers";
import {
  DrumMachineInstrument,
  EMPTY_INSTRUMENT,
  getSampleNames,
} from "./dm-instrument";

export type DrumMachineConfig = {
  format: "ogg" | "m4a";
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
    const instrument: Promise<DrumMachineInstrument> = fetch(
      "https://danigb.github.io/samples/drum-machines/tr-808/dm.json"
    ).then((res) => res.json());
    super(context, {
      ...options,
      buffers: drumMachineLoader(instrument, options.format ?? "ogg"),
      noteToSample: (note, buffers, config) => {
        return [note.note, 0];
      },
    });
    instrument.then((dm) => {
      this.#instrument = dm;
    });
  }

  get sampleNames(): string[] {
    return getSampleNames(this.#instrument);
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
