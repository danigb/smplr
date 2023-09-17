import { ChannelOptions } from "./player/channel";
import { DefaultPlayer } from "./player/default-player";
import { createEmptySampleLayer, findSamplesInLayer } from "./player/layers";
import { AudioBuffers } from "./player/load-audio";
import { toMidi } from "./player/midi";
import {
  InternalPlayer,
  SampleLayer,
  SampleOptions,
  SampleStart,
  SampleStop,
} from "./player/types";
import { SfzInstrumentLoader } from "./sfz2";
import { HttpStorage, Storage } from "./storage";

let instruments: string[] = [];

const BASE_URL = "https://smpldsnds.github.io/sgossner-vcsl/";

export async function getVersilianInstruments(): Promise<string[]> {
  if (instruments.length) return instruments;

  instruments = await fetch(BASE_URL + "sfz_files.json").then((res) =>
    res.json()
  );
  return instruments;
}

function getVcslInstrumentSfzUrl(instrument: string) {
  return BASE_URL + instrument + ".sfz";
}

function getVcslInstrumentSamplesUrl(instrument: string) {
  const base = instrument.slice(0, instrument.lastIndexOf("/") + 1);
  return `https://smpldsnds.github.io/sgossner-vcsl/${base}`;
}

export type VersilianConfig = {
  instrument: string;
  storage: Storage;
};
export type VersilianOptions = Partial<
  VersilianConfig & SampleOptions & ChannelOptions
>;

/**
 * Versilian
 *
 * The Versilian Community Sample Library is an open CC0 general-purpose sample library created by Versilian Studios LLC
 * for the purpose of introducing a set of quality, publicly available samples suitable for use in software and media of all kinds.
 */
export class Versilian implements InternalPlayer {
  private readonly player: DefaultPlayer;
  private readonly layer: SampleLayer;
  public readonly load: Promise<this>;
  private config: VersilianConfig;
  private seqNum = 0;

  constructor(context: BaseAudioContext, options: VersilianOptions = {}) {
    this.config = {
      instrument: options.instrument ?? "Arco",
      storage: options.storage ?? HttpStorage,
    };
    this.player = new DefaultPlayer(context, options);
    this.layer = createEmptySampleLayer();
    const url = getVcslInstrumentSfzUrl(this.config.instrument);

    // REAL
    // https://smpldsnds.github.io/sgossner-vcsl/Electrophones/TX81Z/FM%20Piano/FMPiano_C0_vl1.m4a
    // https://smpldsnds.github.io/sgossner-vcsl/TX81Z%20-%20Piano%201/TX81Z/Piano%201/Piano%201_G%230_vl2.ogg

    const sampleBase = getVcslInstrumentSamplesUrl(this.config.instrument);
    const loader = SfzInstrumentLoader(url, {
      buffers: this.player.buffers,
      layer: this.layer,
      urlFromSampleName: (sampleName, audioExt) => {
        return sampleBase + "/" + sampleName.replace(".wav", audioExt);
      },
    });
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
