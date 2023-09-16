import { ChannelOptions, OutputChannel } from "../player/channel";
import { DefaultPlayer } from "../player/default-player";
import {
  AudioBuffers,
  findFirstSupportedFormat,
  loadAudioBuffer,
} from "../player/load-audio";
import { SampleOptions, SampleStart, SampleStop } from "../player/types";
import { HttpStorage, Storage } from "../storage";
import {
  DrumMachineInstrument,
  EMPTY_INSTRUMENT,
  fetchDrumMachineInstrument,
} from "./dm-instrument";

export function getDrumMachineNames() {
  return Object.keys(INSTRUMENTS);
}

const INSTRUMENTS: Record<string, string> = {
  "TR-808": "https://danigb.github.io/samples/drum-machines/TR-808/dm.json",
  "Casio-RZ1":
    "https://danigb.github.io/samples/drum-machines/Casio-RZ1/dm.json",
  "LM-2": "https://danigb.github.io/samples/drum-machines/LM-2/dm.json",
  "MFB-512": "https://danigb.github.io/samples/drum-machines/MFB-512/dm.json",
  "Roland CR-8000":
    "https://danigb.github.io/samples/drum-machines/Roland-CR-8000/dm.json",
};

export type DrumMachineConfig = ChannelOptions &
  SampleOptions & {
    instrument: string;
    storage?: Storage;
  };

export class DrumMachine {
  #instrument = EMPTY_INSTRUMENT;
  private readonly player: DefaultPlayer;
  public readonly load: Promise<this>;
  public readonly output: OutputChannel;

  public constructor(
    context: AudioContext,
    options?: Partial<DrumMachineConfig>
  ) {
    options = Object.assign({}, options);
    const storage: Storage = options.storage ?? HttpStorage;
    const url = INSTRUMENTS[options.instrument ?? "TR-808"];
    if (!url) throw new Error("Invalid instrument: " + options.instrument);

    const instrument = fetchDrumMachineInstrument(url, storage);
    this.player = new DefaultPlayer(context, options);
    this.output = this.player.output;
    this.load = drumMachineLoader(
      context,
      this.player.buffers,
      instrument,
      storage
    ).then(() => this);

    instrument.then((instrument) => {
      this.#instrument = instrument;
    });
  }

  async loaded() {
    console.warn("deprecated: use load instead");
    return this.load;
  }

  get sampleNames(): string[] {
    return this.#instrument.sampleNames;
  }

  getVariations(name: string): string[] {
    return this.#instrument.sampleNameVariations[name] ?? [];
  }

  start(sample: SampleStart) {
    const sampleName = this.#instrument.nameToSample[sample.note];
    return this.player.start({
      ...sample,
      note: sampleName ? sampleName : sample.note,
      stopId: sample.stopId ?? sample.note,
    });
  }

  stop(sample: SampleStop) {
    return this.player.stop(sample);
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
      data.samples.map(async (sample) => {
        const url = `${data.baseUrl}/${sample}.${format}`;
        const sampleName =
          sample.indexOf("/") !== -1 ? sample : sample.replace("-", "/");
        const buffer = await loadAudioBuffer(context, url, storage);
        if (buffer) buffers[sampleName] = buffer;
      })
    )
  );
}
