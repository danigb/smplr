import { createControl } from "./player/signals";
import { midiVelToGain } from "./player/volume";
import { SfzSampler, SfzSamplerConfig } from "./sfz/sfz-sampler";
import { createTremolo } from "./tremolo";

export function getElectricPianoNames() {
  return Object.keys(INSTRUMENTS);
}

const INSTRUMENTS: Record<string, string> = {
  CP80: "https://danigb.github.io/samples/gs-e-pianos/CP80/cp80.websfz.json",
  PianetT:
    "https://danigb.github.io/samples/gs-e-pianos/Pianet T/pianet-t.websfz.json",
  WurlitzerEP200:
    "https://danigb.github.io/samples/gs-e-pianos/Wurlitzer EP200/wurlitzer-ep200.websfz.json",
  TX81Z:
    "https://danigb.github.io/samples/vcsl/TX81Z/tx81z-fm-piano.websfz.json",
};

export class ElectricPiano extends SfzSampler {
  public readonly tremolo: Readonly<{ level: (value: number) => void }>;
  constructor(
    context: AudioContext,
    options: Partial<SfzSamplerConfig> & { instrument: string }
  ) {
    super(context, {
      ...options,
      instrument: INSTRUMENTS[options.instrument] ?? options.instrument,
    });
    const depth = createControl(0);
    this.tremolo = {
      level: (level) => depth.set(midiVelToGain(level)),
    };
    const tremolo = createTremolo(context, depth.subscribe);
    this.output.addInsert(tremolo);
  }
}
