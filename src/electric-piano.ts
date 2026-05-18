import { Storage } from "./storage";
import { Instrument } from "./smplr";
import { LoadProgress } from "./smplr/types";
import { sfzToPreset } from "./smplr/sfz-convert";
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

const GS_BASE =
  "https://smpldsnds.github.io/sfzinstruments-greg-sullivan-e-pianos";

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
    sfzUrl:
      "https://smpldsnds.github.io/sgossner-vcsl/Electrophones/TX81Z - FM Piano.sfz",
    baseUrl: "https://smpldsnds.github.io/sgossner-vcsl/Electrophones",
    pathFromSampleName: vcslPath,
  },
};

export type ElectricPianoOptions = Partial<{
  instrument: string;
  storage: Storage;
  destination: AudioNode;
  volume: number;
  /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
  pan: number;
  velocity: number;
  onLoadProgress: (progress: LoadProgress) => void;
  /** Audio formats to try, in order of preference. Defaults to ["ogg", "m4a"]. */
  formats: string[];
}>;

type ElectricPianoExtras = {
  tremolo: Readonly<{ level: (value: number) => void }>;
};

export const ElectricPiano = Instrument(
  (
    ctx: BaseAudioContext,
    options: ElectricPianoOptions & { instrument: string },
    smplr,
  ) => {
    const config = INSTRUMENTS[options.instrument];
    if (!config) {
      throw new Error(
        `Unknown electric piano: "${options.instrument}". ` +
          `Valid names: ${Object.keys(INSTRUMENTS).join(", ")}`,
      );
    }

    // Tremolo control + insert node — sync, so `tremolo.level(...)` is
    // callable before `await load` resolves.
    const depth = createControl(0);
    const tremolo: ElectricPianoExtras["tremolo"] = {
      level: (level) => depth.set(midiVelToGain(level)),
    };
    const tremoloNode = createTremolo(ctx, depth.subscribe);
    smplr.output.addInsert(tremoloNode);

    const ready = fetch(config.sfzUrl)
      .then((r) => r.text())
      .then((sfzText) =>
        smplr.loadInstrument(
          sfzToPreset(sfzText, {
            baseUrl: config.baseUrl,
            pathFromSampleName: config.pathFromSampleName,
            formats: options.formats ?? ["ogg", "m4a"],
          }),
        ),
      );

    return { extras: { tremolo }, ready };
  },
);

/** Instance type returned by the {@link ElectricPiano} factory. */
export type ElectricPiano = ReturnType<typeof ElectricPiano>;
