import { HttpStorage, Storage } from "./storage";
import { Smplr, SmplrOptions } from "./smplr";
import { LoadProgress, NoteEvent, StopTarget } from "./smplr/types";
import { sfzToSmplrJson } from "./smplr/sfz-convert";
import { createControl } from "./smplr/signals";
import { midiVelToGain } from "./smplr/volume";
import { createTremolo } from "./tremolo";

export function getElectricPianoNames() {
  return Object.keys(INSTRUMENTS);
}

type InstrumentConfig = {
  sfzUrl: string;
  baseUrl: string;
  pathFromSampleName: (name: string) => string;
};

/** Strip file extension and prepend samples/ (Greg Sullivan pianos) */
function gsPath(name: string): string {
  return "samples/" + name.replace(/\.\w+$/, "");
}

/** Strip file extension (VCSL instruments) */
function vcslPath(name: string): string {
  return name.replace(/\.\w+$/, "");
}

const GS_BASE = "https://smpldsnds.github.io/sfzinstruments-greg-sullivan-e-pianos";

const INSTRUMENTS: Record<string, InstrumentConfig> = {
  CP80: {
    sfzUrl: `${GS_BASE}/cp80/CP80.sfz`,
    baseUrl: `${GS_BASE}/cp80`,
    pathFromSampleName: gsPath,
  },
  PianetT: {
    sfzUrl: `${GS_BASE}/planet-t/Pianet T.sfz`,
    baseUrl: `${GS_BASE}/planet-t`,
    pathFromSampleName: gsPath,
  },
  WurlitzerEP200: {
    sfzUrl: `${GS_BASE}/wurlitzer-ep200/Wurlitzer EP200.sfz`,
    baseUrl: `${GS_BASE}/wurlitzer-ep200`,
    pathFromSampleName: gsPath,
  },
  TX81Z: {
    sfzUrl: "https://smpldsnds.github.io/sgossner-vcsl/Electrophones/TX81Z - FM Piano.sfz",
    baseUrl: "https://smpldsnds.github.io/sgossner-vcsl/Electrophones",
    pathFromSampleName: vcslPath,
  },
};

export type ElectricPianoOptions = Partial<{
  instrument: string;
  storage: Storage;
  destination: AudioNode;
  volume: number;
  velocity: number;
  onLoadProgress: (progress: LoadProgress) => void;
}>;

export class ElectricPiano {
  #smplr: Smplr;
  readonly load: Promise<this>;
  public readonly tremolo: Readonly<{ level: (value: number) => void }>;

  constructor(
    public readonly context: AudioContext,
    options: ElectricPianoOptions & { instrument: string }
  ) {
    const config = INSTRUMENTS[options.instrument];
    if (!config) {
      throw new Error(
        `Unknown electric piano: "${options.instrument}". ` +
          `Valid names: ${Object.keys(INSTRUMENTS).join(", ")}`
      );
    }

    const smplrOptions: SmplrOptions = {
      destination: options.destination,
      volume: options.volume,
      velocity: options.velocity,
      storage: options.storage ?? HttpStorage,
      onLoadProgress: options.onLoadProgress,
    };
    this.#smplr = new Smplr(context, smplrOptions);

    // Tremolo effect
    const depth = createControl(0);
    this.tremolo = {
      level: (level) => depth.set(midiVelToGain(level)),
    };
    const tremolo = createTremolo(context, depth.subscribe);
    this.output.addInsert(tremolo);

    // Fetch raw .sfz and convert to SmplrJson
    this.load = fetch(config.sfzUrl)
      .then((r) => r.text())
      .then((sfzText) =>
        this.#smplr.loadInstrument(
          sfzToSmplrJson(sfzText, {
            baseUrl: config.baseUrl,
            pathFromSampleName: config.pathFromSampleName,
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
