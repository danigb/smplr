import { HttpStorage, Storage } from "../storage";
import { Smplr, SmplrOptions } from "../smplr";
import { LoadProgress, NoteEvent, SmplrGroup, SmplrJson, StopTarget } from "../smplr/types";
import { spreadKeyRanges } from "../smplr/utils";
import { toMidi } from "../smplr/midi";
import { findFirstSupportedFormat } from "../smplr/load-audio";
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
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
  }
>;

export class Soundfont {
  public readonly config: Readonly<SoundfontConfig>;
  #smplr: Smplr;
  #hasLoops = false;
  readonly load: Promise<this>;

  constructor(
    public readonly context: AudioContext,
    options: SoundfontOptions
  ) {
    this.config = getSoundfontConfig(options);

    const smplrOptions: SmplrOptions = {
      destination: options.destination,
      volume: options.volume,
      velocity: options.velocity,
      storage: this.config.storage,
      onLoadProgress: options.onLoadProgress,
    };
    this.#smplr = new Smplr(context, smplrOptions);

    // Apply extra gain insert immediately (output is available before load)
    const gain = context.createGain();
    gain.gain.value = this.config.extraGain;
    this.#smplr.output.addInsert(gain);

    this.load = loadSoundfontData(context, this.config)
      .then(({ buffers, noteNames, loopData }) => {
        this.#hasLoops = !!loopData;
        return this.#smplr.loadInstrument(
          soundfontToSmplrJson(noteNames, loopData),
          buffers
        );
      })
      .then(() => this);
  }

  get hasLoops() {
    return this.#hasLoops;
  }

  get output() {
    return this.#smplr.output;
  }

  async loaded() {
    console.warn("deprecated: use load instead");
    return this.load;
  }

  public disconnect() {
    return this.#smplr.disconnect();
  }

  start(sample: NoteEvent | string | number) {
    return this.#smplr.start(
      typeof sample === "object" ? sample : { note: sample }
    );
  }

  stop(sample?: StopTarget | string | number) {
    return this.#smplr.stop(
      sample === undefined ? undefined : sample
    );
  }
}

// ---------------------------------------------------------------------------
// loadSoundfontData — async loader for base64-encoded MIDI.js files
// ---------------------------------------------------------------------------

type SoundfontData = {
  buffers: Map<string, AudioBuffer>;
  noteNames: string[];
  loopData?: LoopData;
};

async function loadSoundfontData(
  context: AudioContext,
  config: SoundfontConfig
): Promise<SoundfontData> {
  const [{ buffers, noteNames }, loopData] = await Promise.all([
    decodeSoundfontFile(context, config),
    fetchSoundfontLoopData(config.loopDataUrl),
  ]);

  return { buffers, noteNames, loopData };
}

async function decodeSoundfontFile(
  context: AudioContext,
  config: SoundfontConfig
): Promise<{ buffers: Map<string, AudioBuffer>; noteNames: string[] }> {
  const sourceFile = await (await config.storage.fetch(config.instrumentUrl)).text();
  const json = midiJsToJson(sourceFile);

  const noteNames = Object.keys(json);
  const buffers = new Map<string, AudioBuffer>();

  await Promise.all(
    noteNames.map(async (noteName) => {
      const midi = toMidi(noteName);
      if (!midi) return;
      try {
        const audioData = base64ToArrayBuffer(removeBase64Prefix(json[noteName]));
        const buffer = await context.decodeAudioData(audioData);
        buffers.set(noteName, buffer);
      } catch (error) {
        console.warn(
          `Soundfont: failed to decode note ${noteName}`,
          error instanceof Error ? error.message : error
        );
      }
    })
  );

  return { buffers, noteNames: [...buffers.keys()] };
}

// ---------------------------------------------------------------------------
// soundfontToSmplrJson — pure converter function
// ---------------------------------------------------------------------------

/**
 * Convert a list of note names (with optional loop data) to SmplrJson.
 * Uses spreadKeyRanges so notes between recorded pitches pitch-shift correctly.
 */
export function soundfontToSmplrJson(
  noteNames: string[],
  loopData?: LoopData
): SmplrJson {
  const entries: [number, string][] = [];

  for (const noteName of noteNames) {
    const midi = toMidi(noteName);
    if (midi === undefined) continue;
    entries.push([midi, noteName]);
  }

  const spread = spreadKeyRanges(entries);

  const regions: SmplrGroup["regions"] = spread.map(({ keyRange, pitch, sample }) => {
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
  });

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
      "Use 'instrumentUrl' instead of 'instrument' to load from a URL"
    );
    config.instrumentUrl = config.instrument;
    config.instrument = undefined;
  }

  if (!config.instrumentUrl) {
    if (config.instrument) {
      config.instrumentUrl = gleitzKitUrl(config.instrument, config.kit);
    } else {
      throw Error(
        "Soundfont: 'instrument' or 'instrumentUrl' configuration parameter is required"
      );
    }
  } else {
    if (config.kit !== DEFAULT_SOUNDFONT_KIT || config.instrument) {
      console.warn(
        "Soundfont: 'kit' and 'instrument' config parameters are ignored because 'instrumentUrl' is explicitly set."
      );
    }
  }

  if (config.loadLoopData && config.instrument && !config.loopDataUrl) {
    config.loopDataUrl = getGoldstSoundfontLoopsUrl(
      config.instrument,
      config.kit
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
  const decoded = window.atob(base64);
  const len = decoded.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes.buffer;
}
