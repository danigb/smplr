import {
  findFirstSupportedFormat,
  loadAudioBuffer,
} from "./load-audio";
import { HttpStorage, Storage } from "../storage";
import { SmplrJson } from "./types";

/**
 * Loads and caches AudioBuffers for all samples referenced in a SmplrJson.
 *
 * The cache is keyed by resolved URL, so the same audio file is never fetched
 * or decoded twice. Multiple Smplr instances can share one SampleLoader by
 * passing it via SmplrOptions.loader.
 */
export class SampleLoader {
  #context: BaseAudioContext;
  #storage: Storage;
  #cache: Map<string, AudioBuffer> = new Map();

  constructor(context: BaseAudioContext, options?: { storage?: Storage }) {
    this.#context = context;
    this.#storage = options?.storage ?? HttpStorage;
  }

  /**
   * Load all samples referenced in `json`. Returns a Map of sample name →
   * AudioBuffer. Progress is reported via `onProgress` callback or via
   * options object.
   *
   * - `buffers` in options: pre-loaded buffers — skips fetch for these names.
   * - All samples load in parallel. Failed samples are silently omitted.
   */
  async load(
    json: SmplrJson,
    onProgressOrOptions?:
      | ((loaded: number, total: number) => void)
      | {
          buffers?: Map<string, AudioBuffer>;
          onProgress?: (loaded: number, total: number) => void;
        }
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
            this.#storage
          );
          if (fetched) {
            buffer = fetched;
            this.#cache.set(url, buffer);
          }
        }

        if (buffer) result.set(name, buffer);

        loaded++;
        onProgress?.(loaded, total);
      })
    );

    return result;
  }
}

/** Collect all unique region.sample names across all groups. */
function collectSampleNames(json: SmplrJson): string[] {
  const seen = new Set<string>();
  for (const group of json.groups) {
    for (const region of group.regions) {
      seen.add(region.sample);
    }
  }
  return [...seen];
}
