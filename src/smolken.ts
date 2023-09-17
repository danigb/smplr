import { ChannelOptions } from "./player/channel";
import { DefaultPlayer } from "./player/default-player";
import { createEmptySampleLayer, findSamplesInLayer } from "./player/layers";
import {
  AudioBuffers,
  getPreferredAudioExtension,
  loadAudioBuffer,
} from "./player/load-audio";
import { toMidi } from "./player/midi";
import {
  InternalPlayer,
  SampleLayer,
  SampleOptions,
  SampleStart,
  SampleStop,
} from "./player/types";
import { sfzToLayer } from "./sfz2";
import { HttpStorage, Storage } from "./storage";

export function getSmolkenNames() {
  return ["Pizzicato", "Arco", "Switched"];
}

function getSmolkenUrl(instrument: string) {
  const FILES: Record<string, string> = {
    Arco: "arco",
    Pizzicato: "pizz",
    Switched: "switched",
  };
  return `https://smpldsnds.github.io/sfzinstruments-dsmolken-double-bass/d_smolken_rubner_bass_${FILES[instrument]}.sfz`;
}

export type SmolkenConfig = {
  instrument: string;
  storage: Storage;
};
export type SmolkenOptions = Partial<
  SmolkenConfig & SampleOptions & ChannelOptions
>;

export class Smolken implements InternalPlayer {
  private readonly player: DefaultPlayer;
  private readonly layer: SampleLayer;
  public readonly load: Promise<this>;
  private config: SmolkenConfig;
  private seqNum = 0;

  constructor(context: BaseAudioContext, options: SmolkenOptions = {}) {
    this.config = {
      instrument: options.instrument ?? "Arco",
      storage: options.storage ?? HttpStorage,
    };
    this.player = new DefaultPlayer(context, options);
    this.layer = createEmptySampleLayer();

    const loader = loadSmolkenInstrument(
      this.config.instrument,
      this.player.buffers,
      this.layer
    );
    this.load = loader(context, this.config.storage).then(() => this);
  }

  get output() {
    return this.player.output;
  }

  get buffers(): AudioBuffers {
    return this.player.buffers;
  }

  get context(): BaseAudioContext {
    return this.player.context;
  }

  start(sample: SampleStart | string | number) {
    const found = findSamplesInLayer(
      this.layer,
      typeof sample === "object" ? sample : { note: sample },
      this.seqNum
    );
    this.seqNum++;
    const stopAll = found.map((sample) => this.player.start(sample));
    return (time?: number) => stopAll.forEach((stop) => stop(time));
  }

  stop(sample?: SampleStop | string | number) {
    if (sample == undefined) {
      this.player.stop();
      return;
    }

    const toStop = typeof sample === "object" ? sample : { stopId: sample };
    const midi = toMidi(toStop.stopId);
    if (!midi) return;
    toStop.stopId = midi;
    this.player.stop(toStop);
  }

  disconnect(): void {
    this.player.disconnect();
  }
}

function loadSmolkenInstrument(
  instrumentOrUrl: string,
  buffers: AudioBuffers,
  layer: SampleLayer
) {
  const url = instrumentOrUrl.startsWith("http")
    ? instrumentOrUrl
    : getSmolkenUrl(instrumentOrUrl);
  const audioExt = getPreferredAudioExtension();

  return async (context: BaseAudioContext, storage: Storage) => {
    const sfz = await fetch(url).then((res) => res.text());
    const errors = sfzToLayer(sfz, layer);
    if (errors.length) {
      console.warn("Problems converting sfz", errors);
    }
    const sampleNames = new Set<string>();
    layer.regions.forEach((r) => sampleNames.add(r.sampleName));
    return Promise.all(
      Array.from(sampleNames).map(async (sampleName) => {
        const samplePath = sampleName
          .replace("\\", "/")
          .replace(".wav", audioExt);
        const sampleUrl = `https://smpldsnds.github.io/sfzinstruments-dsmolken-double-bass/${samplePath}`;
        const buffer = await loadAudioBuffer(context, sampleUrl, storage);
        buffers[sampleName] = buffer;
      })
    );
  };
}
