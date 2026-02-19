import { Smplr } from "./smplr";
import { NoteEvent, SmplrGroup, SmplrJson, StopTarget } from "./smplr/types";

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
  velocity?: number;
};

export function sf2InstrumentToSmplrJson(
  sf2Instrument: Sf2Instrument,
  context: AudioContext
): { json: SmplrJson; buffers: Map<string, AudioBuffer> } {
  const buffers = new Map<string, AudioBuffer>();
  const regions: SmplrGroup["regions"] = [];

  for (const zone of sf2Instrument.zones) {
    const { sample, keyRange } = zone;
    const { header } = sample;
    const sampleName = header.name;

    const float32 = new Float32Array(sample.data.length);
    for (let i = 0; i < sample.data.length; i++) float32[i] = sample.data[i] / 32768;
    const audioBuffer = context.createBuffer(1, float32.length, header.sampleRate);
    audioBuffer.getChannelData(0).set(float32);
    buffers.set(sampleName, audioBuffer);

    const hasLoop = header.startLoop >= 0 && header.endLoop > header.startLoop;

    regions.push({
      sample: sampleName,
      pitch: header.originalPitch,
      ...(keyRange && { keyRange: [keyRange.lo, keyRange.hi] as [number, number] }),
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

export class Soundfont2Sampler {
  readonly context: AudioContext;
  readonly options: Soundfont2Options;
  soundfont: Sf2 | undefined;
  readonly load: Promise<this>;
  #smplr: Smplr;
  #instrumentNames: string[] = [];

  constructor(context: AudioContext, options: Soundfont2Options) {
    this.context = context;
    this.options = options;
    this.#smplr = new Smplr(context, {
      destination: options.destination,
      volume: options.volume,
      velocity: options.velocity,
    });
    this.load = loadSoundfont(options)
      .then((sf2) => {
        this.soundfont = sf2;
        this.#instrumentNames = sf2.instruments.map(
          (inst: Sf2Instrument) => inst.header.name
        );
      })
      .then(() => this);
  }

  get instrumentNames() {
    return this.#instrumentNames;
  }

  get output() {
    return this.#smplr.output;
  }

  loadInstrument(instrumentName: string): Promise<void> | undefined {
    const sf2inst = this.soundfont?.instruments.find(
      (inst: Sf2Instrument) => inst.header.name === instrumentName
    );
    if (!sf2inst) return undefined;
    const { json, buffers } = sf2InstrumentToSmplrJson(sf2inst, this.context);
    return this.#smplr.loadInstrument(json, buffers);
  }

  start(sample: NoteEvent | string | number) {
    return this.#smplr.start(typeof sample === "object" ? sample : { note: sample });
  }

  stop(sample?: StopTarget | string | number) {
    return this.#smplr.stop(sample === undefined ? undefined : sample);
  }

  disconnect() {
    this.#smplr.disconnect();
  }
}

async function loadSoundfont(options: Soundfont2Options) {
  const buffer = await fetch(options.url).then((res) => res.arrayBuffer());
  const data = new Uint8Array(buffer);
  return options.createSoundfont(data);
}
