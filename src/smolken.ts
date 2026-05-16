import { Storage } from "./storage";
import { Instrument } from "./smplr";
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

export const Smolken = Instrument(
  (ctx: BaseAudioContext, options: SmolkenOptions = {}, smplr) => {
    const sfzUrl = getSmolkenUrl(options.instrument ?? "Arco");
    return fetch(sfzUrl)
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
  }
);
