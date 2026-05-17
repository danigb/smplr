import { Storage } from "./storage";
import { Instrument } from "./smplr";
import type { PluginSmplr } from "./smplr/instrument";
import { LoadProgress } from "./smplr/types";
import { sfzToPreset } from "./smplr/sfz-convert";

const VCSL_BASE_URL = "https://smpldsnds.github.io/sgossner-vcsl";

let instruments: string[] = [];

export async function getVersilianInstruments(): Promise<string[]> {
  if (instruments.length) return instruments;
  instruments = await fetch(VCSL_BASE_URL + "/sfz_files.json").then((res) =>
    res.json(),
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
export const Versilian = Instrument(
  (ctx: BaseAudioContext, options: VersilianOptions = {}, smplr) =>
    loadVersilianInstrument(smplr, options),
);

/** Instance type returned by the {@link Versilian} factory. */
export type Versilian = ReturnType<typeof Versilian>;

/**
 * Fetch the SFZ for a VCSL instrument and load it into `smplr`. Shared by
 * the {@link Versilian} and {@link Mallet} factories — not exported from the
 * package barrel.
 */
export function loadVersilianInstrument(
  smplr: PluginSmplr,
  options: VersilianOptions,
): Promise<void> {
  const instrument = options.instrument ?? "Strings/Violin/Violin - Arco";
  const sfzUrl = `${VCSL_BASE_URL}/${instrument}.sfz`;
  const base = instrument.slice(0, instrument.lastIndexOf("/") + 1);
  const sampleBaseUrl = `${VCSL_BASE_URL}/${base}`;

  return fetch(sfzUrl)
    .then((r) => r.text())
    .then((sfzText) =>
      smplr.loadInstrument(
        sfzToPreset(sfzText, {
          baseUrl: sampleBaseUrl,
          pathFromSampleName: (name) => name.replace(/\.wav$/i, ""),
          formats: ["ogg", "m4a"],
        }),
      ),
    );
}
