import { midiVelToGain } from "./sampler/note";
import { createControl } from "./sampler/signals";
import { SfzSampler, SfzSamplerConfig } from "./sfz-sampler";
import { SfzInstrument } from "./sfz/sfz-kits";
import { createTremolo } from "./tremolo";

export const ElectricPianoInstruments: Record<string, SfzInstrument> = {
  // RhodesMkI: {
  //   name: "RhodesMkI",
  //   websfzUrl:
  //     "https://danigb.github.io/samples/jlearman/rhodes-mki/jrhodes3dst.websfz.json",
  // },
  CP80: {
    name: "CP80",
    websfzUrl:
      "https://danigb.github.io/samples/gs-e-pianos/CP80/cp80.websfz.json",
  },
  PianetT: {
    name: "PianetT",
    websfzUrl:
      "https://danigb.github.io/samples/gs-e-pianos/Pianet T/pianet-t.websfz.json",
  },
  WurlitzerEP200: {
    name: "WurlitzerEP200",
    websfzUrl:
      "https://danigb.github.io/samples/gs-e-pianos/Wurlitzer EP200/wurlitzer-ep200.websfz.json",
  },
};

export class ElectricPiano extends SfzSampler {
  public readonly tremolo: Readonly<{ level: (value: number) => void }>;
  constructor(
    context: AudioContext,
    options: Partial<SfzSamplerConfig> & { instrument: string }
  ) {
    super(context, {
      ...options,
      instrument:
        ElectricPianoInstruments[options.instrument] ?? options.instrument,
    });
    const depth = createControl(0);
    this.tremolo = {
      level: (level) => depth.set(midiVelToGain(level)),
    };
    const tremolo = createTremolo(context, depth.subscribe);
    this.output.addInsert(tremolo);
  }
}
