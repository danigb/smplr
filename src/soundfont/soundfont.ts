import { ChannelOptions } from "../player/channel";
import { findNearestMidi, toMidi } from "../player/midi";
import { Player } from "../player/player";
import { SampleOptions, SampleStart, SampleStop } from "../player/types";
import { HttpStorage, Storage } from "../storage";
import {
  SOUNDFONT_INSTRUMENTS,
  SOUNDFONT_KITS,
  gleitzKitUrl,
  soundfontInstrumentLoader,
} from "./soundfont-instrument";
import {
  LoopData,
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

export type SoundfontOptions = Partial<
  SoundfontConfig & SampleOptions & ChannelOptions
>;

export class Soundfont {
  public readonly config: Readonly<SoundfontConfig>;
  private readonly player: Player;
  #load: Promise<unknown>;
  #loops: LoopData;

  constructor(
    public readonly context: AudioContext,
    options: SoundfontOptions
  ) {
    this.config = getSoundfontConfig(options);
    this.player = new Player(context, options);

    const loader = soundfontInstrumentLoader(
      this.config.instrumentUrl,
      this.config.storage
    );
    this.#load = loader(context, this.player.buffers);
    this.#loops = { status: "not-loaded" };
    if (this.config.loopDataUrl) {
      this.#loops = { status: "loading" };
      this.#load = Promise.all([
        this.#load,
        fetchSoundfontLoopData(this.config.loopDataUrl).then((loopData) => {
          this.#loops = loopData;
        }),
      ]);
    }

    const gain = new GainNode(context, { gain: this.config.extraGain });
    this.player.output.addInsert(gain);
  }

  get output() {
    return this.player.output;
  }

  async loaded() {
    await this.#load;
    return this;
  }

  get hasLoops() {
    return this.#loops.status === "loaded";
  }

  start(sample: SampleStart) {
    const midi = toMidi(sample.note);
    const [note, detune] =
      midi === undefined ? ["", 0] : findNearestMidi(midi, this.player.buffers);
    const loop =
      typeof midi === "number" && this.#loops.status === "loaded"
        ? this.#loops.data[midi]
        : undefined;

    return this.player.start({
      ...sample,
      note,
      detune,
      loop: loop !== undefined,
      loopStart: loop?.[0],
      loopEnd: loop?.[1],
    });
  }

  stop(sample?: SampleStop | string | number) {
    return this.player.stop(sample);
  }
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
