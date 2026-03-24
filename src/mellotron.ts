import { toMidi } from "./smplr/midi";
import { HttpStorage, Storage } from "./storage";
import { Smplr, SmplrOptions } from "./smplr";
import { LoadProgress, SmplrGroup, SmplrJson } from "./smplr/types";
import { spreadKeyRanges } from "./smplr/utils";

const INSTRUMENT_VARIATIONS: Record<string, [string, string]> = {
  "300 STRINGS CELLO": ["300 STRINGS", "CELL"],
  "300 STRINGS VIOLA": ["300 STRINGS", "VIOL"],
};

export function getMellotronNames() {
  return [
    "300 STRINGS CELLO",
    "300 STRINGS VIOLA",
    "8VOICE CHOIR",
    "BASSA+STRNGS",
    "BOYS CHOIR",
    "CHA CHA FLT",
    "CHM CLARINET",
    "CHMB 3 VLNS",
    "CHMB ALTOSAX",
    "CHMB FEMALE",
    "CHMB MALE VC",
    "CHMB TNR SAX",
    "CHMB TRMBONE",
    "CHMB TRUMPET",
    "CHMBLN CELLO",
    "CHMBLN FLUTE",
    "CHMBLN OBOE",
    "DIXIE+TRMBN",
    "FOXTROT+SAX",
    "HALFSP.BRASS",
    "MIXED STRGS",
    "MKII BRASS",
    "MKII GUITAR",
    "MKII ORGAN",
    "MKII SAX",
    "MKII VIBES",
    "MKII VIOLINS",
    "MOVE BS+STGS",
    "STRGS+BRASS",
    "TROMB+TRMPT",
    "TRON 16VLNS",
    "TRON CELLO",
    "TRON FLUTE",
    "TRON VIOLA",
  ];
}

export type MellotronConfig = {
  instrument: string;
  storage: Storage;
};

export type MellotronOptions = Partial<
  MellotronConfig & {
    destination?: AudioNode;
    volume?: number;
    velocity?: number;
    decayTime?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
  }
>;

export function Mellotron(
  context: BaseAudioContext,
  options: MellotronOptions = {}
): Smplr {
  if (new.target) console.warn("smplr: `new Mellotron(ctx, opts)` is deprecated. Call as a function: `Mellotron(ctx, opts)`.");
  const config = getMellotronConfig(options);

  const smplrOptions: SmplrOptions = {
    destination: options.destination,
    volume: options.volume,
    velocity: options.velocity,
    storage: config.storage,
    onLoadProgress: options.onLoadProgress,
  };
  const smplr = new Smplr(context as AudioContext, smplrOptions);

  const variation = INSTRUMENT_VARIATIONS[config.instrument];
  const instrumentName = variation ? variation[0] : config.instrument;
  const baseUrl = `https://smpldsnds.github.io/archiveorg-mellotron/${instrumentName}/`;

  const loadPromise = fetch(baseUrl + "files.json")
    .then((r) => r.json() as Promise<string[]>)
    .then((names) =>
      smplr.loadInstrument(
        mellotronToSmplrJson(names, {
          instrument: instrumentName,
          variation: variation?.[1],
        })
      )
    );

  (smplr as any).ready = loadPromise;

  return smplr;
}

function getMellotronConfig(options: MellotronOptions): MellotronConfig {
  return {
    instrument: options.instrument ?? "MKII VIOLINS",
    storage: options.storage ?? HttpStorage,
  };
}

// ---------------------------------------------------------------------------
// mellotronToSmplrJson — pure converter function
// ---------------------------------------------------------------------------

type MellotronJsonConfig = {
  instrument: string;
  variation?: string;
};

/**
 * Convert a Mellotron files.json sample list to SmplrJson.
 *
 * - Filters by variation string if provided.
 * - Extracts MIDI from the first word of each sample name.
 * - Uses spreadKeyRanges so nearby notes pitch-shift to the nearest sample.
 * - All regions get loopAuto to produce tape-loop playback.
 */
export function mellotronToSmplrJson(
  sampleNames: string[],
  config: MellotronJsonConfig
): SmplrJson {
  const entries: [number, string][] = [];

  for (const sampleName of sampleNames) {
    // Filter by variation (e.g., only "CELL" samples for CELLO variation)
    if (config.variation && !sampleName.includes(config.variation)) continue;

    const midi = toMidi(sampleName.split(" ")[0] ?? "");
    if (!midi) continue;

    entries.push([midi, sampleName]);
  }

  const spread = spreadKeyRanges(entries);
  const baseUrl = `https://smpldsnds.github.io/archiveorg-mellotron/${config.instrument}/`;

  const regions: SmplrGroup["regions"] = spread.map(
    ({ keyRange, pitch, sample }) => ({
      sample,
      keyRange,
      pitch,
      loopAuto: { startRatio: 0.1, endRatio: 0.9 },
    })
  );

  return {
    samples: {
      baseUrl,
      formats: ["ogg", "m4a"],
    },
    groups: [{ regions }],
  };
}
