import { OutputChannel } from "../player/channel";
import { DefaultPlayer, DefaultPlayerConfig } from "../player/default-player";
import {
  AudioBuffers,
  findFirstSupportedFormat,
  loadAudioBuffer,
} from "../player/load-audio";
import { SampleStart, SampleStop } from "../player/types";
import { HttpStorage, Storage } from "../storage";
import {
  DrumMachineInstrument,
  EMPTY_INSTRUMENT,
  fetchDrumMachineInstrument,
  isDrumMachineInstrument,
} from "./dm-instrument";

export function getDrumMachineNames() {
  return Object.keys(INSTRUMENTS);
}

const INSTRUMENTS: Record<string, string> = {
  "TR-808": "https://smpldsnds.github.io/drum-machines/TR-808/dm.json",
  "Casio-RZ1": "https://smpldsnds.github.io/drum-machines/Casio-RZ1/dm.json",
  "LM-2": "https://smpldsnds.github.io/drum-machines/LM-2/dm.json",
  "MFB-512": "https://smpldsnds.github.io/drum-machines/MFB-512/dm.json",
  "Roland CR-8000":
    "https://smpldsnds.github.io/drum-machines/Roland-CR-8000/dm.json",
};

type DrumMachineConfig = {
  instrument: string | DrumMachineInstrument;
  url: string;
  storage: Storage;
};

export type DrumMachineOptions = Partial<
  DrumMachineConfig & DefaultPlayerConfig
>;

function getConfig(options?: DrumMachineOptions): DrumMachineConfig {
  const config = {
    instrument: options?.instrument ?? "TR-808",
    storage: options?.storage ?? HttpStorage,
    url: options?.url ?? "",
  };
  if (typeof config.instrument === "string") {
    config.url ||= INSTRUMENTS[config.instrument];
    if (!config.url)
      throw new Error("Invalid instrument: " + config.instrument);
  } else if (!isDrumMachineInstrument(config.instrument)) {
    throw new Error("Invalid instrument: " + config.instrument);
  }

  return config;
}

export class DrumMachine {
  #instrument = EMPTY_INSTRUMENT;
  private readonly player: DefaultPlayer;
  public readonly load: Promise<this>;
  public readonly output: OutputChannel;

  public constructor(context: AudioContext, options?: DrumMachineOptions) {
    const config = getConfig(options);

    const instrument = isDrumMachineInstrument(config.instrument)
      ? Promise.resolve(config.instrument)
      : fetchDrumMachineInstrument(config.url, config.storage);
    this.player = new DefaultPlayer(context, options);
    this.output = this.player.output;
    this.load = drumMachineLoader(
      context,
      this.player.buffers,
      instrument,
      config.storage
    ).then(() => this);

    instrument.then((instrument) => {
      this.#instrument = instrument;
    });
  }

  getSampleNames(): string[] {
    return this.#instrument.samples.slice();
  }

  getGroupNames(): string[] {
    return this.#instrument.groupNames.slice();
  }

  getSampleNamesForGroup(groupName: string): string[] {
    return this.#instrument.sampleGroupVariations[groupName] ?? [];
  }

  start(sample: SampleStart) {
    const sampleName = this.#instrument.nameToSampleName[sample.note];
    return this.player.start({
      ...sample,
      note: sampleName ? sampleName : sample.note,
      stopId: sample.stopId ?? sample.note,
    });
  }

  stop(sample: SampleStop) {
    return this.player.stop(sample);
  }

  /** @deprecated */
  async loaded() {
    console.warn("deprecated: use load instead");
    return this.load;
  }
  /** @deprecated */
  get sampleNames(): string[] {
    console.log("deprecated: Use getGroupNames instead");
    return this.#instrument.groupNames.slice();
  }
  /** @deprecated */
  getVariations(groupName: string): string[] {
    console.warn("deprecated: use getSampleNamesForGroup");
    return this.#instrument.sampleGroupVariations[groupName] ?? [];
  }
}

function drumMachineLoader(
  context: BaseAudioContext,
  buffers: AudioBuffers,
  instrument: Promise<DrumMachineInstrument>,
  storage: Storage
) {
  const format = findFirstSupportedFormat(["ogg", "m4a"]) ?? "ogg";
  return instrument.then((data) =>
    Promise.all(
      data.samples.map(async (sampleName) => {
        const url = `${data.baseUrl}/${sampleName}.${format}`;
        const buffer = await loadAudioBuffer(context, url, storage);
        if (buffer) buffers[sampleName] = buffer;
      })
    )
  );
}
