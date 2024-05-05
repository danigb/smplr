import { RegionPlayer, RegionPlayerOptions } from "./player/region-player";
import {
  RegionGroup,
  SampleRegion,
  SampleStart,
  SampleStop,
  SamplerInstrument,
} from "./player/types";

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

export type Soundfont2Options = Partial<RegionPlayerOptions> & {
  url: string;
  createSoundfont: (data: Uint8Array) => Sf2;
};

export class Soundfont2Sampler {
  player: RegionPlayer;
  soundfont: Sf2 | undefined;
  load: Promise<this>;
  #instrumentNames: string[] = [];

  constructor(
    public readonly context: AudioContext,
    public readonly options: Soundfont2Options
  ) {
    this.player = new RegionPlayer(context, options);
    this.load = loadSoundfont(options)
      .then((soundfont) => {
        this.soundfont = soundfont;
        this.#instrumentNames = soundfont.instruments.map(
          (instrument) => instrument.header.name
        );
      })
      .then(() => this);
  }

  get instrumentNames() {
    return this.#instrumentNames;
  }

  loadInstrument(instrumentName: string) {
    const sf2instrument = this.soundfont?.instruments.find(
      (inst) => inst.header.name === instrumentName
    );
    if (!sf2instrument) return;

    const buffers = this.player.buffers;
    const group: RegionGroup = {
      regions: [],
    };

    for (const zone of sf2instrument.zones) {
      const sample = zone.sample;
      const header = sample.header;
      const buffer = getAudioBufferFromSample(this.context, sample);
      let region: SampleRegion = {
        sampleName: sample.header.name,
        midiPitch: sample.header.originalPitch,
        midiLow: zone.keyRange?.lo,
        midiHigh: zone.keyRange?.hi,
        sample: {
          loop: header.startLoop >= 0 && header.endLoop > header.startLoop,
          loopStart: header.startLoop / header.sampleRate,
          loopEnd: header.endLoop / header.sampleRate,
        },
      };
      group.regions.push(region);
      buffers[region.sampleName] = buffer;
    }

    const instrument: SamplerInstrument = {
      groups: [group],
      options: this.options,
    };

    this.player.instrument = instrument;

    return [instrument, buffers];
  }

  get output() {
    return this.player.output;
  }

  start(sample: SampleStart | string | number) {
    return this.player.start(sample);
  }

  stop(sample?: SampleStop | string | number) {
    return this.player.stop(sample);
  }

  disconnect(): void {
    this.player.disconnect();
  }
}

function getAudioBufferFromSample(
  context: AudioContext,
  sample: Sf2Sample
): AudioBuffer {
  const { header, data: int16 } = sample;
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  const audioBuffer = context.createBuffer(
    1,
    float32.length,
    header.sampleRate
  );
  const channelData = audioBuffer.getChannelData(0);
  channelData.set(float32);
  return audioBuffer;
}

async function loadSoundfont(options: Soundfont2Options) {
  const buffer = await fetch(options.url).then((res) => res.arrayBuffer());
  const data = new Uint8Array(buffer);
  return options.createSoundfont(data);
}
