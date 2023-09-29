import { DefaultPlayerConfig } from "./player/default-player";
import { AudioBuffers } from "./player/load-audio";
import { RegionPlayer } from "./player/region-player";
import {
  InternalPlayer,
  RegionGroup,
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

export function VcslInstrumentLoader(
  instrument: string,
  buffers: AudioBuffers,
  group: RegionGroup
) {
  const url = getVcslInstrumentSfzUrl(instrument);
  const base = instrument.slice(0, instrument.lastIndexOf("/") + 1);
  const sampleBase = `https://smpldsnds.github.io/sgossner-vcsl/${base}`;
  return SfzInstrumentLoader(url, {
    buffers: buffers,
    group: group,
    urlFromSampleName: (sampleName, audioExt) => {
      return sampleBase + "/" + sampleName.replace(".wav", audioExt);
    },
  });
}

export type VersilianConfig = {
  instrument: string;
  storage: Storage;
};
export type VersilianOptions = Partial<VersilianConfig & DefaultPlayerConfig>;

/**
 * Versilian
 *
 * The Versilian Community Sample Library is an open CC0 general-purpose sample library created by Versilian Studios LLC
 * for the purpose of introducing a set of quality, publicly available samples suitable for use in software and media of all kinds.
 */
export class Versilian implements InternalPlayer {
  private readonly player: RegionPlayer;
  public readonly load: Promise<this>;
  private config: VersilianConfig;

  constructor(context: BaseAudioContext, options: VersilianOptions = {}) {
    this.config = {
      instrument: options.instrument ?? "Arco",
      storage: options.storage ?? HttpStorage,
    };
    this.player = new RegionPlayer(context, options);

    const loader = VcslInstrumentLoader(
      this.config.instrument,
      this.player.buffers,
      this.player.group
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
    return this.player.start(sample);
  }

  stop(sample?: SampleStop | string | number) {
    return this.player.stop(sample);
  }

  disconnect(): void {
    this.player.disconnect();
  }
}
