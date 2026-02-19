import { HttpStorage, Storage } from "./storage";
import { Smplr, SmplrOptions } from "./smplr";
import { LoadProgress, NoteEvent, StopTarget } from "./smplr/types";
import { sfzToSmplrJson } from "./smplr/sfz-convert";

export function getSmolkenNames() {
  return ["Pizzicato", "Arco", "Switched"];
}

function getSmolkenUrl(instrument: string) {
  const FILES: Record<string, string> = {
    Arco: "arco",
    Pizzicato: "pizz",
    Switched: "switched",
  };
  return `https://smpldsnds.github.io/sfzinstruments-dsmolken-double-bass/d_smolken_rubner_bass_${FILES[instrument]}.sfz`;
}

export type SmolkenConfig = {
  instrument: string;
  storage: Storage;
};

export type SmolkenOptions = Partial<
  SmolkenConfig & {
    destination?: AudioNode;
    volume?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
  }
>;

const SMOLKEN_BASE_URL =
  "https://smpldsnds.github.io/sfzinstruments-dsmolken-double-bass";

export class Smolken {
  #smplr: Smplr;
  readonly load: Promise<this>;

  constructor(
    public readonly context: BaseAudioContext,
    options: SmolkenOptions = {}
  ) {
    const config: SmolkenConfig = {
      instrument: options.instrument ?? "Arco",
      storage: options.storage ?? HttpStorage,
    };

    const smplrOptions: SmplrOptions = {
      destination: options.destination,
      volume: options.volume,
      velocity: options.velocity,
      storage: config.storage,
      onLoadProgress: options.onLoadProgress,
    };
    this.#smplr = new Smplr(context as AudioContext, smplrOptions);

    const sfzUrl = getSmolkenUrl(config.instrument);

    this.load = fetch(sfzUrl)
      .then((r) => r.text())
      .then((sfzText) =>
        this.#smplr.loadInstrument(
          sfzToSmplrJson(sfzText, {
            baseUrl: SMOLKEN_BASE_URL,
            pathFromSampleName: (name) =>
              name.replace(/\\/g, "/").replace(/\.wav$/i, ""),
            formats: ["ogg", "m4a"],
          })
        )
      )
      .then(() => this);
  }

  get output() {
    return this.#smplr.output;
  }

  get loadProgress() {
    return this.#smplr.loadProgress;
  }

  start(sample: NoteEvent | string | number) {
    return this.#smplr.start(
      typeof sample === "object" ? sample : { note: sample }
    );
  }

  stop(target?: StopTarget) {
    return this.#smplr.stop(target);
  }

  disconnect() {
    return this.#smplr.disconnect();
  }
}
