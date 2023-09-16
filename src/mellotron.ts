import { ChannelOptions } from "./player/channel";
import { DefaultPlayer } from "./player/default-player";
import { createEmptySampleLayer } from "./player/layers";
import { AudioBuffers } from "./player/load-audio";
import { toMidi } from "./player/midi";
import {
  InternalPlayer,
  SampleLayer,
  SampleOptions,
  SampleStart,
  SampleStop,
} from "./player/types";
import { HttpStorage, Storage } from "./storage";

export function getMellotronNames() {
  [
    "CHMB FEMALE",
    "CHA CHA FLT",
    "TRON CELLO",
    "MKII VIBES",
    "MIXED STRGS",
    "CHMB 3 VLNS",
    "CHMB MALE VC",
    "CHMB TRUMPET",
    "CHMBLN CELLO",
    "FOXTROT+SAX",
    "CHM CLARINET",
    "CHMB TNR SAX",
    "CHMB ALTOSAX",
    "300 STRINGS",
    "DIXIE+TRMBN",
    "MKII ORGAN",
    "CHMBLN FLUTE",
    "BASSA+STRNGS",
    "TRON VIOLA",
    "TRON FLUTE",
    "HALFSP.BRASS",
    "STRGS+BRASS",
    "MKII SAX",
    "BOYS CHOIR",
    "MKII BRASS",
    "CHMB TRMBONE",
    "MKII VIOLINS",
    "MKII GUITAR",
    "MOVE BS+STGS",
    "TRON 16VLNS",
    "8VOICE CHOIR",
    "TROMB+TRMPT",
    "CHMBLN OBOE",
  ];
}

export type MellotronConfig = {
  instrument: string;
  storage: Storage;
};

export type MellotronOptions = Partial<
  SampleOptions & ChannelOptions & MellotronConfig
>;

export class Mellotron implements InternalPlayer {
  private readonly config: MellotronConfig;
  private readonly player: DefaultPlayer;
  private readonly layer: SampleLayer;
  readonly onLoad: Promise<this>;

  public constructor(
    public readonly context: BaseAudioContext,
    options: MellotronOptions
  ) {
    this.config = getMellotronConfig(options);
    this.player = new DefaultPlayer(context, options);
    this.layer = createEmptySampleLayer(options);

    const loader = loadMellotronInstrument(
      this.config.instrument,
      context,
      this.player.buffers,
      this.layer
    );
    this.onLoad = loader.then(() => this);
  }

  get buffers() {
    return this.player.buffers;
  }

  get output() {
    return this.player.output;
  }

  start(sample: SampleStart) {
    return this.player.start(sample);
  }
  stop(sample?: SampleStop | undefined) {
    this.player.stop(sample);
  }
  disconnect() {
    this.player.disconnect();
  }
}

function getMellotronConfig(
  options: Partial<SampleOptions & ChannelOptions & MellotronConfig>
): MellotronConfig {
  return {
    instrument: options.instrument ?? "MKII VIOLINS",
    storage: options.storage ?? HttpStorage,
  };
}
async function loadMellotronInstrument(
  instrument: string,
  context: BaseAudioContext,
  buffers: AudioBuffers,
  layer: SampleLayer
) {
  const instrumentUrl = `https://smpldsnds.github.io/archiveorg-mellotron/${instrument}/files.json`;
  const files = await fetch(instrumentUrl).then(
    (res) => res.json() as Promise<string[]>
  );
  for (const fileName of files) {
    const midi = toMidi(fileName.split(" ")[0] ?? "");
    console.log({ fileName, midi });
  }
}
