import { HttpStorage, Storage } from "./storage";
import { Smplr, SmplrOptions } from "./smplr";
import { LoadProgress, NoteEvent, StopTarget } from "./smplr/types";
import { sfzToSmplrJson } from "./smplr/sfz-convert";

const VCSL_BASE_URL = "https://smpldsnds.github.io/sgossner-vcsl";

let instruments: string[] = [];

export async function getVersilianInstruments(): Promise<string[]> {
  if (instruments.length) return instruments;
  instruments = await fetch(VCSL_BASE_URL + "/sfz_files.json").then((res) =>
    res.json()
  );
  return instruments;
}

export type VersilianConfig = {
  instrument: string;
  storage: Storage;
};

export type VersilianOptions = Partial<
  VersilianConfig & {
    destination?: AudioNode;
    volume?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
  }
>;

/**
 * Versilian
 *
 * The Versilian Community Sample Library is an open CC0 general-purpose sample
 * library created by Versilian Studios LLC.
 */
export class Versilian {
  #smplr: Smplr;
  readonly load: Promise<this>;

  constructor(
    public readonly context: BaseAudioContext,
    options: VersilianOptions = {}
  ) {
    const config: VersilianConfig = {
      instrument: options.instrument ?? "Strings/Violin/Violin - Arco",
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

    const sfzUrl = `${VCSL_BASE_URL}/${config.instrument}.sfz`;
    const base = config.instrument.slice(
      0,
      config.instrument.lastIndexOf("/") + 1
    );
    const sampleBaseUrl = `${VCSL_BASE_URL}/${base}`;

    this.load = fetch(sfzUrl)
      .then((r) => r.text())
      .then((sfzText) =>
        this.#smplr.loadInstrument(
          sfzToSmplrJson(sfzText, {
            baseUrl: sampleBaseUrl,
            pathFromSampleName: (name) => name.replace(/\.wav$/i, ""),
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
