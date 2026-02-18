import { SampleLoader } from "./sample-loader";
import { SmplrJson } from "./types";

// ---------------------------------------------------------------------------
// Mock load-audio so tests run without real HTTP or Web Audio
// ---------------------------------------------------------------------------

jest.mock("../player/load-audio", () => ({
  findFirstSupportedFormat: jest.fn(),
  loadAudioBuffer: jest.fn(),
}));

import {
  findFirstSupportedFormat,
  loadAudioBuffer,
} from "../player/load-audio";

const mockFindFormat = findFirstSupportedFormat as jest.Mock;
const mockLoadBuffer = loadAudioBuffer as jest.Mock;

function makeBuffer(id = "buf"): AudioBuffer {
  return { id } as unknown as AudioBuffer;
}

function makeContext(): BaseAudioContext {
  return {} as BaseAudioContext;
}

/** Minimal SmplrJson with one group and one region. */
function makeJson(overrides?: Partial<SmplrJson>): SmplrJson {
  return {
    samples: {
      baseUrl: "https://example.com/samples",
      formats: ["ogg", "mp3"],
    },
    groups: [
      {
        regions: [{ sample: "C4" }],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // By default, findFirstSupportedFormat returns the first format
  mockFindFormat.mockReturnValue("ogg");
  // By default, loadAudioBuffer returns a fresh buffer
  mockLoadBuffer.mockResolvedValue(makeBuffer());
});

// ---------------------------------------------------------------------------
// URL resolution
// ---------------------------------------------------------------------------

describe("URL resolution", () => {
  it("builds URL as baseUrl/sampleName.format", async () => {
    const loader = new SampleLoader(makeContext());
    await loader.load(makeJson());

    expect(mockLoadBuffer).toHaveBeenCalledWith(
      expect.anything(),
      "https://example.com/samples/C4.ogg",
      expect.anything()
    );
  });

  it("strips trailing slash from baseUrl", async () => {
    const loader = new SampleLoader(makeContext());
    await loader.load(
      makeJson({
        samples: {
          baseUrl: "https://example.com/samples/",
          formats: ["ogg"],
        },
      })
    );

    expect(mockLoadBuffer).toHaveBeenCalledWith(
      expect.anything(),
      "https://example.com/samples/C4.ogg",
      expect.anything()
    );
  });

  it("applies samples.map when present", async () => {
    const loader = new SampleLoader(makeContext());
    await loader.load(
      makeJson({
        samples: {
          baseUrl: "https://example.com/samples",
          formats: ["ogg"],
          map: { C4: "piano/C4v1" },
        },
      })
    );

    expect(mockLoadBuffer).toHaveBeenCalledWith(
      expect.anything(),
      "https://example.com/samples/piano/C4v1.ogg",
      expect.anything()
    );
  });

  it("uses sample name as path when not in map", async () => {
    const loader = new SampleLoader(makeContext());
    await loader.load(
      makeJson({
        samples: {
          baseUrl: "https://example.com/samples",
          formats: ["ogg"],
          map: { D4: "piano/D4v1" }, // C4 not in map
        },
      })
    );

    expect(mockLoadBuffer).toHaveBeenCalledWith(
      expect.anything(),
      "https://example.com/samples/C4.ogg",
      expect.anything()
    );
  });
});

// ---------------------------------------------------------------------------
// Format selection
// ---------------------------------------------------------------------------

describe("format selection", () => {
  it("uses the format returned by findFirstSupportedFormat", async () => {
    mockFindFormat.mockReturnValue("mp3");
    const loader = new SampleLoader(makeContext());
    await loader.load(makeJson());

    expect(mockLoadBuffer).toHaveBeenCalledWith(
      expect.anything(),
      "https://example.com/samples/C4.mp3",
      expect.anything()
    );
  });

  it("falls back to formats[0] when findFirstSupportedFormat returns null", async () => {
    mockFindFormat.mockReturnValue(null);
    const loader = new SampleLoader(makeContext());
    await loader.load(
      makeJson({ samples: { baseUrl: "https://example.com/samples", formats: ["mp3", "ogg"] } })
    );

    expect(mockLoadBuffer).toHaveBeenCalledWith(
      expect.anything(),
      "https://example.com/samples/C4.mp3",
      expect.anything()
    );
  });

  it("falls back to 'ogg' when findFirstSupportedFormat returns null and formats is empty", async () => {
    mockFindFormat.mockReturnValue(null);
    const loader = new SampleLoader(makeContext());
    await loader.load(
      makeJson({ samples: { baseUrl: "https://example.com/samples", formats: [] } })
    );

    expect(mockLoadBuffer).toHaveBeenCalledWith(
      expect.anything(),
      "https://example.com/samples/C4.ogg",
      expect.anything()
    );
  });
});

// ---------------------------------------------------------------------------
// Result map
// ---------------------------------------------------------------------------

describe("result map", () => {
  it("returns a Map with sample name → AudioBuffer", async () => {
    const buf = makeBuffer("test");
    mockLoadBuffer.mockResolvedValue(buf);
    const loader = new SampleLoader(makeContext());
    const result = await loader.load(makeJson());

    expect(result.get("C4")).toBe(buf);
  });

  it("omits samples whose buffer could not be loaded", async () => {
    mockLoadBuffer.mockResolvedValue(undefined);
    const loader = new SampleLoader(makeContext());
    const result = await loader.load(makeJson());

    expect(result.size).toBe(0);
  });

  it("includes only samples that loaded successfully", async () => {
    const json: SmplrJson = {
      samples: { baseUrl: "https://example.com", formats: ["ogg"] },
      groups: [
        { regions: [{ sample: "C4" }, { sample: "D4" }] },
      ],
    };
    const bufC4 = makeBuffer("C4");
    mockLoadBuffer
      .mockResolvedValueOnce(bufC4)   // C4 succeeds
      .mockResolvedValueOnce(undefined); // D4 fails

    const loader = new SampleLoader(makeContext());
    const result = await loader.load(json);

    expect(result.get("C4")).toBe(bufC4);
    expect(result.has("D4")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sample name deduplication
// ---------------------------------------------------------------------------

describe("deduplication", () => {
  it("loads each unique sample name only once even if it appears in multiple regions", async () => {
    const json: SmplrJson = {
      samples: { baseUrl: "https://example.com", formats: ["ogg"] },
      groups: [
        { regions: [{ sample: "C4" }, { sample: "C4" }] },
        { regions: [{ sample: "C4" }] },
      ],
    };

    const loader = new SampleLoader(makeContext());
    await loader.load(json);

    expect(mockLoadBuffer).toHaveBeenCalledTimes(1);
  });

  it("loads distinct sample names separately", async () => {
    const json: SmplrJson = {
      samples: { baseUrl: "https://example.com", formats: ["ogg"] },
      groups: [
        { regions: [{ sample: "C4" }, { sample: "D4" }] },
      ],
    };

    const loader = new SampleLoader(makeContext());
    await loader.load(json);

    expect(mockLoadBuffer).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

describe("caching", () => {
  it("does not call loadAudioBuffer again for a URL already in cache", async () => {
    const loader = new SampleLoader(makeContext());

    await loader.load(makeJson());
    expect(mockLoadBuffer).toHaveBeenCalledTimes(1);

    // Second load with same json → same URL → cache hit
    await loader.load(makeJson());
    expect(mockLoadBuffer).toHaveBeenCalledTimes(1); // still 1
  });

  it("returns the cached buffer on second load", async () => {
    const buf = makeBuffer("cached");
    mockLoadBuffer.mockResolvedValue(buf);
    const loader = new SampleLoader(makeContext());

    await loader.load(makeJson());
    const result2 = await loader.load(makeJson());

    expect(result2.get("C4")).toBe(buf);
  });

  it("cache is keyed by resolved URL, so different baseUrls are fetched separately", async () => {
    const loader = new SampleLoader(makeContext());

    await loader.load(makeJson({ samples: { baseUrl: "https://a.com", formats: ["ogg"] } }));
    await loader.load(makeJson({ samples: { baseUrl: "https://b.com", formats: ["ogg"] } }));

    expect(mockLoadBuffer).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Progress callback
// ---------------------------------------------------------------------------

describe("onProgress callback", () => {
  it("is called once per sample with increasing loaded count", async () => {
    const json: SmplrJson = {
      samples: { baseUrl: "https://example.com", formats: ["ogg"] },
      groups: [{ regions: [{ sample: "C4" }, { sample: "D4" }] }],
    };

    const calls: [number, number][] = [];
    const loader = new SampleLoader(makeContext());
    await loader.load(json, (loaded, total) => calls.push([loaded, total]));

    expect(calls).toHaveLength(2);
    // total is always 2 (known upfront)
    expect(calls.every(([, t]) => t === 2)).toBe(true);
    // loaded values are 1 and 2 (order may vary due to Promise.all)
    const loadedValues = calls.map(([l]) => l).sort();
    expect(loadedValues).toEqual([1, 2]);
  });

  it("fires for cache hits as well", async () => {
    const loader = new SampleLoader(makeContext());
    await loader.load(makeJson()); // fills cache

    const calls: [number, number][] = [];
    await loader.load(makeJson(), (loaded, total) => calls.push([loaded, total]));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([1, 1]);
  });

  it("fires even when buffer fails to load", async () => {
    mockLoadBuffer.mockResolvedValue(undefined);
    const calls: [number, number][] = [];
    const loader = new SampleLoader(makeContext());
    await loader.load(makeJson(), (loaded, total) => calls.push([loaded, total]));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([1, 1]);
  });

  it("total equals number of unique sample names, not total regions", async () => {
    const json: SmplrJson = {
      samples: { baseUrl: "https://example.com", formats: ["ogg"] },
      groups: [
        { regions: [{ sample: "C4" }, { sample: "C4" }, { sample: "D4" }] },
      ],
    };

    const totals: number[] = [];
    const loader = new SampleLoader(makeContext());
    await loader.load(json, (_, total) => totals.push(total));

    // 2 unique samples (C4, D4), so total should be 2
    expect(totals.every((t) => t === 2)).toBe(true);
    expect(totals).toHaveLength(2);
  });
});
