import { ChannelOptions } from "./player/channel";
import { DefaultPlayer } from "./player/default-player";
import {
  createEmptySampleLayer,
  findFirstSampleInLayer,
  spreadRegions,
} from "./player/layers";
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
import { HttpStorage, Storage } from "./storage";

export function getMellotronNames() {
  return [
    "300 STRINGS",
    "8VOICE CHOIR",
    "BASSA+STRNGS",
    "BOYS CHOIR",
    "CHA CHA FLT",
    "CHM CLARINET",
    "CHMB 3 VLNS",
    "CHMB ALTOSAX",
    "CHMB FEMALE",
    "CHMB MALE VC",
    "CHMB TNR SAX",
    "CHMB TRMBONE",
    "CHMB TRUMPET",
    "CHMBLN CELLO",
    "CHMBLN FLUTE",
    "CHMBLN OBOE",
    "DIXIE+TRMBN",
    "FOXTROT+SAX",
    "HALFSP.BRASS",
    "MIXED STRGS",
    "MKII BRASS",
    "MKII GUITAR",
    "MKII ORGAN",
    "MKII SAX",
    "MKII VIBES",
    "MKII VIOLINS",
    "MOVE BS+STGS",
    "STRGS+BRASS",
    "TROMB+TRMPT",
    "TRON 16VLNS",
    "TRON CELLO",
    "TRON FLUTE",
    "TRON VIOLA",
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
      this.config.storage,
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

  start(sample: SampleStart | string | number) {
    const found = findFirstSampleInLayer(
      this.layer,
      typeof sample === "object" ? { ...sample } : { note: sample }
    );

    console.log({ found, sample, reg: this.layer.regions });

    if (!found) return () => undefined;

    return this.player.start(found);
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
function loadMellotronInstrument(
  instrument: string,
  context: BaseAudioContext,
  storage: Storage,
  buffers: AudioBuffers,
  layer: SampleLayer
) {
  const baseUrl = `https://smpldsnds.github.io/archiveorg-mellotron/${instrument}/`;
  const audioExt = getPreferredAudioExtension();
  return fetch(baseUrl + "files.json")
    .then((res) => res.json() as Promise<string[]>)
    .then((sampleNames) =>
      Promise.all(
        sampleNames.map((sampleName) => {
          const midi = toMidi(sampleName.split(" ")[0] ?? "");
          if (!midi) return;

          layer.regions.push({
            sampleName: sampleName,
            sampleCenter: midi,
          });
          const sampleUrl = baseUrl + sampleName + audioExt;
          loadAudioBuffer(context, sampleUrl, storage).then((audioBuffer) => {
            buffers[sampleName] = audioBuffer;
          });
        })
      )
    )
    .then(() => spreadRegions(layer.regions));
}
