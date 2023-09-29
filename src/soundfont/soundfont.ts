import { DefaultPlayer, DefaultPlayerConfig } from "../player/default-player";
import {
  createEmptyRegionGroup,
  findFirstSampleInRegions,
} from "../player/layers";
import { AudioBuffers } from "../player/load-audio";
import { RegionGroup, SampleStart, SampleStop } from "../player/types";
import { HttpStorage, Storage } from "../storage";
import {
  SOUNDFONT_INSTRUMENTS,
  SOUNDFONT_KITS,
  gleitzKitUrl,
  soundfontInstrumentLoader,
} from "./soundfont-instrument";
import {
  fetchSoundfontLoopData,
  getGoldstSoundfontLoopsUrl,
} from "./soundfont-loops";

export function getSoundfontKits() {
  return SOUNDFONT_KITS;
}

export function getSoundfontNames() {
  return SOUNDFONT_INSTRUMENTS;
}

type SoundfontConfig = {
  kit: "FluidR3_GM" | "MusyngKite" | string;
  instrument?: string;
  instrumentUrl: string;
  storage: Storage;
  extraGain: number;
  loadLoopData: boolean;
  loopDataUrl?: string;
};

export type SoundfontOptions = Partial<SoundfontConfig & DefaultPlayerConfig>;

export class Soundfont {
  public readonly config: Readonly<SoundfontConfig>;
  private readonly player: DefaultPlayer;
  public readonly load: Promise<this>;
  public readonly group: RegionGroup;
  #hasLoops: boolean;

  constructor(
    public readonly context: AudioContext,
    options: SoundfontOptions
  ) {
    this.config = getSoundfontConfig(options);
    this.player = new DefaultPlayer(context, options);
    this.group = createEmptyRegionGroup();

    this.#hasLoops = false;
    const loader = soundfontLoader(
      this.config.instrumentUrl,
      this.config.loopDataUrl,
      this.player.buffers,
      this.group
    );
    this.load = loader(context, this.config.storage).then((hasLoops) => {
      this.#hasLoops = hasLoops;
      return this;
    });

    const gain = new GainNode(context, { gain: this.config.extraGain });
    this.player.output.addInsert(gain);
  }

  get output() {
    return this.player.output;
  }

  get hasLoops() {
    return this.#hasLoops;
  }

  async loaded() {
    console.warn("deprecated: use load instead");
    return this.load;
  }

  public disconnect() {
    this.player.disconnect();
  }

  start(sample: SampleStart | string | number) {
    const found = findFirstSampleInRegions(
      this.group,
      typeof sample === "object" ? sample : { note: sample }
    );
    if (!found) return () => undefined;

    return this.player.start(found);
  }

  stop(sample?: SampleStop | string | number) {
    return this.player.stop(sample);
  }
}

function soundfontLoader(
  url: string,
  loopsUrl: string | undefined,
  buffers: AudioBuffers,
  group: RegionGroup
) {
  const loadInstrument = soundfontInstrumentLoader(url, buffers, group);
  return async (context: BaseAudioContext, storage: Storage) => {
    const [_, loops] = await Promise.all([
      loadInstrument(context, storage),
      fetchSoundfontLoopData(loopsUrl),
    ]);

    if (loops) {
      group.regions.forEach((region) => {
        const loop = loops[region.midiPitch];
        if (loop) {
          region.sample ??= {};
          region.sample.loop = true;
          region.sample.loopStart = loop[0];
          region.sample.loopEnd = loop[1];
        }
      });
    }
    return !!loops;
  };
}

function getSoundfontConfig(options: SoundfontOptions): SoundfontConfig {
  if (!options.instrument && !options.instrumentUrl) {
    throw Error("Soundfont: instrument or instrumentUrl is required");
  }
  const config = {
    kit: "MusyngKite",
    instrument: options.instrument,
    storage: options.storage ?? HttpStorage,
    // This is to compensate the low volume of the original samples
    extraGain: options.extraGain ?? 5,
    loadLoopData: options.loadLoopData ?? false,
    loopDataUrl: options.loopDataUrl,
    instrumentUrl: options.instrumentUrl ?? "",
  };
  if (config.instrument && config.instrument.startsWith("http")) {
    console.warn(
      "Use 'instrumentUrl' instead of 'instrument' to load from a URL"
    );
    config.instrumentUrl = config.instrument;
    config.instrument = undefined;
  }
  if (config.instrument && !config.instrumentUrl) {
    config.instrumentUrl = gleitzKitUrl(config.instrument, config.kit);
  }

  if (config.loadLoopData && config.instrument && !config.loopDataUrl) {
    config.loopDataUrl = getGoldstSoundfontLoopsUrl(
      config.instrument,
      config.kit
    );
  }

  return config;
}
