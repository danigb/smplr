import { SfzSampler, SfzSamplerConfig } from "./sfz-sampler";
import { SfzInstrument } from "./sfz/sfz-kits";

const ElectricPianoInstruments: Record<string, SfzInstrument> = {
  RhodesMkI: {
    name: "RhodesMkI",
    websfzUrl:
      "https://danigb.github.io/samples/jlearman/rhodes-mki/jrhodes3dst.websfz.json",
  },
  CP80: {
    name: "CP80",
    websfzUrl:
      "https://danigb.github.io/samples/gs-e-pianos/CP80/cp80.websfz.json",
  },
  "Pianet T": {
    name: "Pianet T",
    websfzUrl:
      "https://danigb.github.io/samples/gs-e-pianos/Pianet T/pianet-t.websfz.json",
  },
  "Wurlitzer EP200": {
    name: "Wurlitzer EP200",
    websfzUrl:
      "https://danigb.github.io/samples/gs-e-pianos/Wurlitzer EP200/wurlitzer-ep200.websfz.json",
  },
};

export class ElectricPiano extends SfzSampler {
  constructor(
    context: AudioContext,
    instrument: string,
    options: Partial<SfzSamplerConfig>
  ) {
    super(context, ElectricPianoInstruments[instrument] ?? instrument, options);
  }
}
