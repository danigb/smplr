import {
  AudioBuffers,
  AudioBuffersLoader,
  loadAudioBuffer,
} from "./smplr/load-audio";
import { toMidi } from "./smplr/midi";
import { HttpStorage, Storage } from "./storage";
import { Instrument } from "./smplr";
import { LoadProgress, SmplrJson } from "./smplr/types";
import { spreadKeyRanges } from "./smplr/utils";

type SamplerBase = {
  storage?: Storage;
  detune?: number;
  volume?: number;
  velocity?: number;
  decayTime?: number;
  lpfCutoffHz?: number;
  destination?: AudioNode;
  volumeToGain?: (volume: number) => number;
  onLoadProgress?: (progress: LoadProgress) => void;
};

type SamplerBuffers =
  | Record<string | number, string | AudioBuffer | AudioBuffers>
  | AudioBuffersLoader;

type SamplerBuffersInput = {
  buffers?: SamplerBuffers;
  json?: never;
};

type SamplerJsonInput = {
  json: SmplrJson;
  buffers?: never;
};

export type SamplerConfig = SamplerBase &
  (SamplerBuffersInput | SamplerJsonInput);

/** Input accepted by {@link Sampler.reload}: a `SmplrJson` schema or a flat buffers record/loader. */
export type SamplerReloadInput = SmplrJson | SamplerBuffers;

type SamplerExtras = {
  reload: (input: SamplerReloadInput) => Promise<void>;
};

function isSmplrJsonInput(x: unknown): x is SmplrJson {
  return (
    typeof x === "object" &&
    x !== null &&
    "groups" in x &&
    Array.isArray((x as SmplrJson).groups)
  );
}

/**
 * A Sampler instrument. Accepts either a flat record of samples
 * (`{ buffers: { C4: "url" } }`) or a full `SmplrJson` schema
 * (`{ json: { samples, groups, ... } }`) for advanced use cases including
 * per-region pitch/velocity/round-robin control.
 *
 * Use `sampler.reload(input)` to swap content at runtime. `reload` accepts
 * either shape (flat record or `SmplrJson`), regardless of which mode was
 * used at construction.
 */
export const Sampler = Instrument<SamplerConfig, SamplerExtras>(
  (ctx: BaseAudioContext, options: SamplerConfig = {}, smplr) => {
    const storage = options.storage ?? HttpStorage;

    const loadFromInput = (input: SamplerReloadInput): Promise<void> => {
      if (isSmplrJsonInput(input)) {
        return smplr.loadInstrument(input);
      }
      return getSource(ctx, input)
        .then((source) => buildSamplerBuffers(source, ctx, storage, options))
        .then(({ json, buffers }) => smplr.loadInstrument(json, buffers));
    };

    const initialInput: SamplerReloadInput =
      "json" in options && options.json
        ? options.json
        : ((options as SamplerBuffersInput).buffers ?? {});

    return {
      extras: { reload: loadFromInput },
      ready: loadFromInput(initialInput),
    };
  },
);

function getSource(
  ctx: BaseAudioContext,
  raw: NonNullable<Partial<SamplerConfig>["buffers"]>,
): Promise<Record<string | number, string | AudioBuffer>> {
  if (typeof raw === "function") {
    const ab: AudioBuffers = {};
    return (raw as AudioBuffersLoader)(ctx, ab).then(
      () => ab as Record<string | number, string | AudioBuffer>,
    );
  }
  return Promise.resolve(raw as Record<string | number, string | AudioBuffer>);
}

// ---------------------------------------------------------------------------
// samplerToSmplrJson — pure converter function (no async)
// ---------------------------------------------------------------------------

type SamplerJsonOptions = Pick<
  SamplerConfig,
  "decayTime" | "lpfCutoffHz" | "detune"
>;

type ConvertResult = {
  json: SmplrJson;
  /** Resolved AudioBuffer instances, including URL-fetched ones. */
  buffers: Map<string, AudioBuffer>;
};

/**
 * Load all URL samples and build a SmplrJson + pre-loaded buffers map.
 * All samples (URL-fetched and pre-provided AudioBuffers) are passed as
 * pre-loaded, so SampleLoader never makes network requests.
 */
async function buildSamplerBuffers(
  source: Record<string | number, string | AudioBuffer>,
  context: BaseAudioContext,
  storage: Storage,
  options: Partial<SamplerJsonOptions>,
): Promise<ConvertResult> {
  const { json, urlMap, preloaded } = samplerToSmplrJson(source, options);

  // Fetch URL-based samples
  await Promise.all(
    Object.entries(urlMap).map(async ([name, url]) => {
      const buffer = await loadAudioBuffer(context, url, storage);
      if (buffer) preloaded.set(name, buffer);
    }),
  );

  return { json, buffers: preloaded };
}

type InternalConvertResult = {
  json: SmplrJson;
  urlMap: Record<string, string>;
  preloaded: Map<string, AudioBuffer>;
};

/**
 * Convert a flat source Record to SmplrJson + separated URL map + pre-loaded buffers.
 *
 * - Keys that are valid MIDI names/numbers → MIDI-mapped regions.
 *   If ALL keys are MIDI-parseable, spread key ranges (pitch-shifting).
 *   Otherwise each MIDI key gets an exact [n, n] range.
 * - Non-MIDI keys are assigned sequential MIDI numbers and added to `aliases`.
 * - AudioBuffer values → pre-loaded map (no fetch).
 * - String URL values → urlMap (fetched asynchronously by caller).
 */
export function samplerToSmplrJson(
  source: Record<string | number, string | AudioBuffer>,
  options: Partial<SamplerJsonOptions> = {},
): InternalConvertResult {
  const keys = Object.keys(source);
  const preloaded = new Map<string, AudioBuffer>();
  const urlMap: Record<string, string> = {};
  const aliases: Record<string, number> = {};

  // Separate MIDI-parseable keys from arbitrary string keys
  const midiEntries: [number, string][] = [];
  const nonMidiKeys: string[] = [];

  for (const key of keys) {
    const midi = toMidi(key as string | number);
    if (midi !== undefined) {
      midiEntries.push([midi, key]);
    } else {
      nonMidiKeys.push(key);
    }
  }

  const allMidi = nonMidiKeys.length === 0;

  type Entry = {
    midi: number;
    key: string;
    sampleName: string;
    keyRange: [number, number];
    pitch: number;
  };

  const entries: Entry[] = [];

  if (allMidi && midiEntries.length > 0) {
    // All keys are MIDI → spread key ranges for pitch-shifting
    const spread = spreadKeyRanges(
      midiEntries.map(([midi, key]) => [midi, key] as [number, string]),
    );
    for (let i = 0; i < midiEntries.length; i++) {
      const [midi, key] = midiEntries[i];
      const { keyRange, pitch } = spread[i];
      entries.push({ midi, key, sampleName: key, keyRange, pitch });
    }
  } else {
    // Mixed or all non-MIDI: exact ranges for MIDI keys, sequential for others
    for (const [midi, key] of midiEntries) {
      entries.push({
        midi,
        key,
        sampleName: key,
        keyRange: [midi, midi],
        pitch: midi,
      });
    }

    let seqMidi = 0;
    for (const key of nonMidiKeys) {
      while (entries.some((e) => e.midi === seqMidi)) seqMidi++;
      const midi = seqMidi++;
      aliases[key] = midi;
      entries.push({
        midi,
        key,
        sampleName: key,
        keyRange: [midi, midi],
        pitch: midi,
      });
    }
  }

  // Populate pre-loaded map and URL map
  for (const { key, sampleName } of entries) {
    const value = source[key];
    if (value instanceof AudioBuffer) {
      preloaded.set(sampleName, value);
    } else if (typeof value === "string") {
      urlMap[sampleName] = value;
    }
  }

  const json: SmplrJson = {
    // baseUrl doesn't matter: all samples will be pre-loaded
    samples: { baseUrl: "", formats: ["ogg"] },
    groups: [
      {
        regions: entries.map(({ sampleName, keyRange, pitch }) => ({
          sample: sampleName,
          keyRange,
          pitch,
        })),
      },
    ],
    aliases: Object.keys(aliases).length > 0 ? aliases : undefined,
    defaults: {
      ampRelease: options.decayTime,
      lpfCutoffHz: options.lpfCutoffHz,
      detune: options.detune,
    },
  };

  return { json, urlMap, preloaded };
}

/** Instance type returned by the {@link Sampler} factory. */
export type Sampler = ReturnType<typeof Sampler>;
