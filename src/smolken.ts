import { HttpStorage, Storage } from "./storage";
import { Smplr, SmplrOptions } from "./smplr";
import { LoadProgress } from "./smplr/types";
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

export function Smolken(
  context: BaseAudioContext,
  options: SmolkenOptions = {}
): Smplr {
  if (new.target) console.warn("smplr: `new Smolken(ctx, opts)` is deprecated. Call as a function: `Smolken(ctx, opts)`.");
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
  const smplr = new Smplr(context as AudioContext, smplrOptions);

  const sfzUrl = getSmolkenUrl(config.instrument);

  const loadPromise = fetch(sfzUrl)
    .then((r) => r.text())
    .then((sfzText) =>
      smplr.loadInstrument(
        sfzToSmplrJson(sfzText, {
          baseUrl: SMOLKEN_BASE_URL,
          pathFromSampleName: (name) =>
            name.replace(/\\/g, "/").replace(/\.wav$/i, ""),
          formats: ["ogg", "m4a"],
        })
      )
    );

  (smplr as any).ready = loadPromise;

  return smplr;
}
