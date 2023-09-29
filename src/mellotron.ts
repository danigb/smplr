import { ChannelConfig } from "./player/channel";
import { DefaultPlayer, DefaultPlayerConfig } from "./player/default-player";
import {
  createEmptyRegionGroup,
  findFirstSampleInRegions,
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
  RegionGroup,
  SampleOptions,
  SampleStart,
  SampleStop,
} from "./player/types";
import { HttpStorage, Storage } from "./storage";

const INSTRUMENT_VARIATIONS: Record<string, [string, string]> = {
  "300 STRINGS CELLO": ["300 STRINGS", "CELL"],
  "300 STRINGS VIOLA": ["300 STRINGS", "VIOL"],
};

export function getMellotronNames() {
  return [
    "300 STRINGS CELLO",
    "300 STRINGS VIOLA",
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

export type MellotronOptions = Partial<MellotronConfig & DefaultPlayerConfig>;

export class Mellotron implements InternalPlayer {
  private readonly config: MellotronConfig;
  private readonly player: DefaultPlayer;
  private readonly group: RegionGroup;
  readonly load: Promise<this>;

  public constructor(
    public readonly context: BaseAudioContext,
    options: MellotronOptions
  ) {
    this.config = getMellotronConfig(options);
    this.player = new DefaultPlayer(context, options);
    this.group = createEmptyRegionGroup(options);

    const loader = loadMellotronInstrument(
      this.config.instrument,
      this.player.buffers,
      this.group
    );
    this.load = loader(context, this.config.storage).then(() => this);
  }

  get buffers() {
    return this.player.buffers;
  }

  get output() {
    return this.player.output;
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
    this.player.stop(sample);
  }
  disconnect() {
    this.player.disconnect();
  }
}

function getMellotronConfig(
  options: Partial<SampleOptions & ChannelConfig & MellotronConfig>
): MellotronConfig {
  return {
    instrument: options.instrument ?? "MKII VIOLINS",
    storage: options.storage ?? HttpStorage,
  };
}
function loadMellotronInstrument(
  instrument: string,
  buffers: AudioBuffers,
  group: RegionGroup
) {
  let variation = INSTRUMENT_VARIATIONS[instrument];
  if (variation) instrument = variation[0];

  return (context: BaseAudioContext, storage: Storage) => {
    const baseUrl = `https://smpldsnds.github.io/archiveorg-mellotron/${instrument}/`;
    const audioExt = getPreferredAudioExtension();
    return fetch(baseUrl + "files.json")
      .then((res) => res.json() as Promise<string[]>)
      .then((sampleNames) =>
        Promise.all(
          sampleNames.map((sampleName) => {
            if (variation && !sampleName.includes(variation[1])) return;

            const midi = toMidi(sampleName.split(" ")[0] ?? "");
            if (!midi) return;

            const sampleUrl = baseUrl + sampleName + audioExt;
            loadAudioBuffer(context, sampleUrl, storage).then((audioBuffer) => {
              buffers[sampleName] = audioBuffer;
              const duration = audioBuffer?.duration ?? 0;
              group.regions.push({
                sampleName: sampleName,
                midiPitch: midi,
                sample: {
                  loop: true,
                  loopStart: duration / 10,
                  loopEnd: duration - duration / 10,
                },
              });
            });
          })
        )
      )
      .then(() => {
        spreadRegions(group.regions);
      });
  };
}
