import { Instrument } from "./smplr";
import { SmplrGroup, SmplrPreset } from "./smplr/types";

type Sf2 = {
  instruments: Sf2Instrument[];
};

type Sf2Instrument = {
  header: {
    name: string;
  };
  zones: Sf2Zone[];
};

type Sf2Zone = {
  sample: Sf2Sample;
  keyRange?: { lo: number; hi: number };
};

type Sf2Sample = {
  data: Int16Array;
  header: {
    name: string;
    sampleRate: number;
    originalPitch: number;
    pitchCorrection: number;
    start: number;
    end: number;
    startLoop: number;
    endLoop: number;
  };
};

export type Soundfont2Options = {
  url: string;
  createSoundfont: (data: Uint8Array) => Sf2;
  destination?: AudioNode;
  volume?: number;
  /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
  pan?: number;
  velocity?: number;
};

export function sf2InstrumentToPreset(
  sf2Instrument: Sf2Instrument,
  context: BaseAudioContext,
): { json: SmplrPreset; buffers: Map<string, AudioBuffer> } {
  const buffers = new Map<string, AudioBuffer>();
  const regions: SmplrGroup["regions"] = [];

  for (const zone of sf2Instrument.zones) {
    const { sample, keyRange } = zone;
    const { header } = sample;
    const sampleName = header.name;

    const float32 = new Float32Array(sample.data.length);
    for (let i = 0; i < sample.data.length; i++)
      float32[i] = sample.data[i] / 32768;
    const audioBuffer = context.createBuffer(
      1,
      float32.length,
      header.sampleRate,
    );
    audioBuffer.getChannelData(0).set(float32);
    buffers.set(sampleName, audioBuffer);

    const hasLoop = header.startLoop >= 0 && header.endLoop > header.startLoop;

    regions.push({
      sample: sampleName,
      pitch: header.originalPitch,
      ...(keyRange && {
        keyRange: [keyRange.lo, keyRange.hi] as [number, number],
      }),
      ...(hasLoop && {
        loop: true,
        loopStart: header.startLoop / header.sampleRate,
        loopEnd: header.endLoop / header.sampleRate,
      }),
    });
  }

  return {
    json: { samples: { baseUrl: "", formats: [] }, groups: [{ regions }] },
    buffers,
  };
}

type Soundfont2SamplerExtras = {
  readonly instrumentNames: string[];
  loadInstrument(instrumentName: string): Promise<void> | undefined;
};

export const Soundfont2Sampler = Instrument(
  (ctx: BaseAudioContext, options: Soundfont2Options, smplr) => {
    // Mutable closure state — extras read these; parse promise populates them.
    let soundfont: Sf2 | undefined = undefined;
    let instrumentNamesList: string[] = [];

    // Capture the base `loadInstrument(json, buffers)` *before* the extras
    // below shadow it on the instance — otherwise the call inside the
    // override would recurse into itself with the wrong arity.
    const baseLoadInstrument = smplr.loadInstrument.bind(smplr);

    const extras: Soundfont2SamplerExtras = {
      get instrumentNames(): string[] {
        return instrumentNamesList;
      },
      loadInstrument(instrumentName) {
        const sf2inst = soundfont?.instruments.find(
          (inst: Sf2Instrument) => inst.header.name === instrumentName,
        );
        if (!sf2inst) return undefined;
        const { json, buffers } = sf2InstrumentToPreset(sf2inst, ctx);
        return baseLoadInstrument(json, buffers);
      },
    };

    const ready = loadSoundfont(options).then((sf2) => {
      soundfont = sf2;
      instrumentNamesList = sf2.instruments.map(
        (inst: Sf2Instrument) => inst.header.name,
      );
    });

    return { extras, ready };
  },
);

/** Instance type returned by the {@link Soundfont2Sampler} factory. */
export type Soundfont2Sampler = ReturnType<typeof Soundfont2Sampler>;

async function loadSoundfont(options: Soundfont2Options) {
  const buffer = await fetch(options.url).then((res) => res.arrayBuffer());
  const data = new Uint8Array(buffer);
  return options.createSoundfont(data);
}
