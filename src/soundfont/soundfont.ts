import { HttpStorage, Storage } from "../storage";
import { Instrument } from "../smplr";
import { LoadProgress, SmplrGroup, SmplrPreset } from "../smplr/types";
import { spreadKeyRanges } from "../smplr/utils";
import { toMidi } from "../smplr/midi";
import { filterPreset, NotesToLoad } from "../smplr/notes-to-load";
import {
  SOUNDFONT_INSTRUMENTS,
  SOUNDFONT_KITS,
  DEFAULT_SOUNDFONT_KIT,
  gleitzKitUrl,
} from "./soundfont-instrument";
import {
  LoopData,
  fetchSoundfontLoopData,
  getGoldstSoundfontLoopsUrl,
} from "./soundfont-loops";

export function getSoundfontKits() {
  return SOUNDFONT_KITS;
}

export function getSoundfontNames() {
  return SOUNDFONT_INSTRUMENTS;
}

type SoundfontConfig = {
  kit: "FluidR3_GM" | "MusyngKite" | string;
  instrument?: string;
  instrumentUrl: string;
  storage: Storage;
  extraGain: number;
  loadLoopData: boolean;
  loopDataUrl?: string;
};

export type SoundfontOptions = Partial<
  SoundfontConfig & {
    destination?: AudioNode;
    volume?: number;
    /** Stereo pan position (-1 = full left, 0 = centre, +1 = full right). */
    pan?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
    /** Only decode the samples needed to play these notes. */
    notesToLoad?: NotesToLoad;
  }
>;

export const Soundfont = Instrument(
  (ctx: BaseAudioContext, options: SoundfontOptions = {}, smplr) => {
    const config = getSoundfontConfig(options);

    // Apply extra gain insert synchronously, before the first audible note
    // can reach the output.
    const gain = ctx.createGain();
    gain.gain.value = config.extraGain;
    smplr.output.addInsert(gain);

    return loadSoundfontData(ctx, config, options.notesToLoad).then(
      ({ preset, buffers }) => smplr.loadInstrument(preset, buffers),
    );
  },
);

/** Instance type returned by the {@link Soundfont} factory. */
export type Soundfont = ReturnType<typeof Soundfont>;

// ---------------------------------------------------------------------------
// loadSoundfontData — async loader for base64-encoded MIDI.js files
// ---------------------------------------------------------------------------

type SoundfontData = {
  preset: SmplrPreset;
  buffers: Map<string, AudioBuffer>;
};

/**
 * Fetch a MIDI.js file and decode the notes needed by `notesToLoad` (all of
 * them when omitted). The preset only includes notes that decoded, so their
 * neighbours cover the ones that failed.
 */
async function loadSoundfontData(
  context: BaseAudioContext,
  config: SoundfontConfig,
  notesToLoad: NotesToLoad | undefined,
): Promise<SoundfontData> {
  const [json, loopData] = await Promise.all([
    fetchMidiJs(config),
    fetchSoundfontLoopData(config.loopDataUrl),
  ]);
  const noteNames = Object.keys(json).filter(
    (noteName) => toMidi(noteName) !== undefined,
  );
  const buffers = new Map<string, AudioBuffer>();
  const failed = new Set<string>();

  // A failed decode changes which neighbour covers that note, and the
  // neighbour may not be decoded yet — so repeat until nothing is missing.
  while (true) {
    const preset = soundfontToPreset(
      noteNames.filter((noteName) => !failed.has(noteName)),
      loopData,
    );
    const missing = sampleNames(
      filterPreset(preset, notesToLoad).preset,
    ).filter((noteName) => !buffers.has(noteName));
    if (missing.length === 0) return { preset, buffers };

    await Promise.all(
      missing.map(async (noteName) => {
        const buffer = await decodeNote(context, noteName, json[noteName]);
        if (buffer) buffers.set(noteName, buffer);
        else failed.add(noteName);
      }),
    );
  }
}

async function fetchMidiJs(
  config: SoundfontConfig,
): Promise<Record<string, string>> {
  const sourceFile = await (
    await config.storage.fetch(config.instrumentUrl)
  ).text();
  return midiJsToJson(sourceFile);
}

async function decodeNote(
  context: BaseAudioContext,
  noteName: string,
  data: string,
): Promise<AudioBuffer | undefined> {
  try {
    const audioData = base64ToArrayBuffer(removeBase64Prefix(data));
    return await context.decodeAudioData(audioData);
  } catch (error) {
    console.warn(
      `Soundfont: failed to decode note ${noteName}`,
      error instanceof Error ? error.message : error,
    );
    return undefined;
  }
}

function sampleNames(preset: SmplrPreset): string[] {
  const names = new Set<string>();
  for (const group of preset.groups) {
    for (const region of group.regions) names.add(region.sample);
  }
  return [...names];
}

// ---------------------------------------------------------------------------
// soundfontToPreset — pure converter function
// ---------------------------------------------------------------------------

/**
 * Convert a list of note names (with optional loop data) to SmplrPreset.
 * Uses spreadKeyRanges so notes between recorded pitches pitch-shift correctly.
 */
export function soundfontToPreset(
  noteNames: string[],
  loopData?: LoopData,
): SmplrPreset {
  const entries: [number, string][] = [];

  for (const noteName of noteNames) {
    const midi = toMidi(noteName);
    if (midi === undefined) continue;
    entries.push([midi, noteName]);
  }

  const spread = spreadKeyRanges(entries);

  const regions: SmplrGroup["regions"] = spread.map(
    ({ keyRange, pitch, sample }) => {
      const region: SmplrGroup["regions"][number] = { sample, keyRange, pitch };

      // Apply loop data if available
      if (loopData) {
        const loop = loopData[pitch];
        if (loop) {
          region.loop = true;
          region.loopStart = loop[0];
          region.loopEnd = loop[1];
        }
      }

      return region;
    },
  );

  return {
    // baseUrl doesn't matter — all buffers are pre-loaded
    samples: { baseUrl: "", formats: ["ogg"] },
    groups: [{ regions }],
  };
}

// ---------------------------------------------------------------------------
// getSoundfontConfig
// ---------------------------------------------------------------------------

function getSoundfontConfig(options: SoundfontOptions): SoundfontConfig {
  if (!options.instrument && !options.instrumentUrl) {
    throw Error("Soundfont: instrument or instrumentUrl is required");
  }
  const config = {
    kit: options.kit ?? DEFAULT_SOUNDFONT_KIT,
    instrument: options.instrument,
    storage: options.storage ?? HttpStorage,
    extraGain: options.extraGain ?? 5,
    loadLoopData: options.loadLoopData ?? false,
    loopDataUrl: options.loopDataUrl,
    instrumentUrl: options.instrumentUrl ?? "",
  };

  if (config.instrument && config.instrument.startsWith("http")) {
    console.warn(
      "Use 'instrumentUrl' instead of 'instrument' to load from a URL",
    );
    config.instrumentUrl = config.instrument;
    config.instrument = undefined;
  }

  if (!config.instrumentUrl) {
    if (config.instrument) {
      config.instrumentUrl = gleitzKitUrl(config.instrument, config.kit);
    } else {
      throw Error(
        "Soundfont: 'instrument' or 'instrumentUrl' configuration parameter is required",
      );
    }
  } else {
    if (config.kit !== DEFAULT_SOUNDFONT_KIT || config.instrument) {
      console.warn(
        "Soundfont: 'kit' and 'instrument' config parameters are ignored because 'instrumentUrl' is explicitly set.",
      );
    }
  }

  if (config.loadLoopData && config.instrument && !config.loopDataUrl) {
    config.loopDataUrl = getGoldstSoundfontLoopsUrl(
      config.instrument,
      config.kit,
    );
  }

  return config;
}

// ---------------------------------------------------------------------------
// Base64 / MIDI.js helpers
// ---------------------------------------------------------------------------

function midiJsToJson(source: string): Record<string, string> {
  const header = source.indexOf("MIDI.Soundfont.");
  if (header < 0) throw Error("Invalid MIDI.js Soundfont format");
  const start = source.indexOf("=", header) + 2;
  const end = source.lastIndexOf(",");
  return JSON.parse(source.slice(start, end) + "}");
}

function removeBase64Prefix(audioBase64: string) {
  return audioBase64.slice(audioBase64.indexOf(",") + 1);
}

function base64ToArrayBuffer(base64: string) {
  // `atob` is a global in browsers and Node 16+ — avoid `window` so this works
  // in Node/SSR contexts (e.g. unit tests, offline rendering).
  const decoded = atob(base64);
  const len = decoded.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes.buffer;
}
