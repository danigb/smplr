import { asConstructable } from "./as-constructable";
import { findFirstSupportedFormat, loadAudioBuffer } from "./load-audio";
import { HttpStorage, Storage } from "../storage";
import { SmplrPreset } from "./types";

/**
 * Loads and decodes AudioBuffers for the samples referenced by a {@link SmplrPreset}.
 * Used internally by every smplr instrument; pass an instance via
 * {@link SmplrOptions.loader} to share buffer caching across multiple instruments.
 */
export interface SampleLoader {
  /**
   * Load all samples referenced by `json`. Returns a Map keyed by sample
   * name (`region.sample`), values are decoded `AudioBuffer`s. Failed
   * samples are silently omitted (callers handle absence at lookup time).
   *
   * Internally cached by resolved URL, so repeated calls with the same
   * baseUrl/format/path do not re-fetch.
   *
   * @param json The preset describing samples to load.
   * @param options
   *   - `buffers`: pre-decoded buffers keyed by sample name — skip fetch for these.
   *   - `onProgress`: called with `(loaded, total)` per sample (including cache hits).
   */
  load(
    json: SmplrPreset,
    options?: SampleLoaderLoadOptions,
  ): Promise<Map<string, AudioBuffer>>;

  /**
   * @deprecated Pass `{ onProgress }` instead. The bare-callback form is kept
   * for compatibility; the options form is the canonical 1.x signature.
   */
  load(
    json: SmplrPreset,
    onProgress: (loaded: number, total: number) => void,
  ): Promise<Map<string, AudioBuffer>>;
}

/** Options accepted by `SampleLoader(context, options)`. */
export type SampleLoaderOptions = {
  /** Custom storage backend (e.g. `CacheStorage` for offline). Defaults to `HttpStorage`. */
  storage?: Storage;
};

/** Options accepted by `loader.load(json, options)`. */
export type SampleLoaderLoadOptions = {
  /** Pre-decoded buffers keyed by sample name — skip fetch for these. */
  buffers?: Map<string, AudioBuffer>;
  /** Called once per sample (including cache hits) with cumulative progress. */
  onProgress?: (loaded: number, total: number) => void;
};

class SampleLoaderImpl implements SampleLoader {
  #context: BaseAudioContext;
  #storage: Storage;
  #cache: Map<string, AudioBuffer> = new Map();

  constructor(context: BaseAudioContext, options?: SampleLoaderOptions) {
    this.#context = context;
    this.#storage = options?.storage ?? HttpStorage;
  }

  async load(
    json: SmplrPreset,
    onProgressOrOptions?:
      | ((loaded: number, total: number) => void)
      | SampleLoaderLoadOptions,
  ): Promise<Map<string, AudioBuffer>> {
    // Normalise the second argument: support legacy callback or new options object
    const preloaded =
      typeof onProgressOrOptions === "object"
        ? onProgressOrOptions.buffers
        : undefined;
    const onProgress =
      typeof onProgressOrOptions === "function"
        ? onProgressOrOptions
        : onProgressOrOptions?.onProgress;

    const format =
      findFirstSupportedFormat(json.samples.formats) ??
      json.samples.formats[0] ??
      "ogg";

    const base = json.samples.baseUrl.replace(/\/$/, "");
    const names = collectSampleNames(json);
    const total = names.length;
    let loaded = 0;

    const result = new Map<string, AudioBuffer>();

    await Promise.all(
      names.map(async (name) => {
        // 1. Check pre-loaded buffers first — no fetch needed
        const pre = preloaded?.get(name);
        if (pre) {
          result.set(name, pre);
          loaded++;
          onProgress?.(loaded, total);
          return;
        }

        // 2. Build URL and check internal cache
        const path = json.samples.map?.[name] ?? name;
        const url = `${base}/${path}.${format}`;

        let buffer = this.#cache.get(url);

        if (!buffer) {
          const fetched = await loadAudioBuffer(
            this.#context,
            url,
            this.#storage,
          );
          if (fetched) {
            buffer = fetched;
            this.#cache.set(url, buffer);
          }
        }

        if (buffer) result.set(name, buffer);

        loaded++;
        onProgress?.(loaded, total);
      }),
    );

    return result;
  }
}

/** Collect all unique region.sample names across all groups. */
function collectSampleNames(json: SmplrPreset): string[] {
  const seen = new Set<string>();
  for (const group of json.groups) {
    for (const region of group.regions) {
      seen.add(region.sample);
    }
  }
  return [...seen];
}

type SampleLoaderFactory = {
  (context: BaseAudioContext, options?: SampleLoaderOptions): SampleLoader;
  /** @deprecated Call as a function: `SampleLoader(...)` instead of `new SampleLoader(...)`. */
  new (context: BaseAudioContext, options?: SampleLoaderOptions): SampleLoader;
};

export const SampleLoader: SampleLoaderFactory =
  asConstructable(SampleLoaderImpl);
