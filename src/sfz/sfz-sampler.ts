import { HttpStorage, Storage } from "../storage";
import { Smplr, SmplrOptions } from "../smplr";
import { LoadProgress, NoteEvent, StopTarget } from "../smplr/types";
import { websfzToSmplrJson } from "../smplr/websfz-convert";
import { SfzInstrumentLoader } from "./sfz-load";
import { SfzInstrument } from "./sfz-kits";
import { Websfz } from "./websfz";

export type SfzSamplerConfig = {
  instrument: SfzInstrument | Websfz | string;
  storage: Storage;
  destination: AudioNode;
  volume: number;
  velocity: number;
  detune: number;
  decayTime?: number;
  lpfCutoffHz?: number;
  onLoadProgress?: (progress: LoadProgress) => void;
};

export class SfzSampler {
  #smplr: Smplr;
  readonly load: Promise<this>;

  constructor(
    public readonly context: AudioContext,
    options: Partial<SfzSamplerConfig> & Pick<SfzSamplerConfig, "instrument">
  ) {
    const smplrOptions: SmplrOptions = {
      destination: options.destination,
      volume: options.volume,
      velocity: options.velocity,
      storage: options.storage,
      onLoadProgress: options.onLoadProgress,
    };
    this.#smplr = new Smplr(context, smplrOptions);

    const storage = options.storage ?? HttpStorage;

    this.load = SfzInstrumentLoader(options.instrument, storage)
      .then((websfz) =>
        this.#smplr.loadInstrument(websfzToSmplrJson(websfz))
      )
      .then(() => this);
  }

  get output() {
    return this.#smplr.output;
  }

  start(sample: NoteEvent | string | number): ReturnType<Smplr["start"]> {
    return this.#smplr.start(
      typeof sample === "object" ? sample : { note: sample }
    );
  }

  stop(target?: StopTarget) {
    return this.#smplr.stop(target);
  }

  setCC(cc: number, value: number) {
    return this.#smplr.setCC(cc, value);
  }

  async loaded() {
    console.warn("deprecated: use load instead");
    return this.load;
  }

  disconnect() {
    return this.#smplr.disconnect();
  }
}
