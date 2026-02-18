import { spreadKeyRanges, pianoToSmplrJson, LAYERS, SplendidGrandPiano } from "./splendid-grand-piano";

// ---------------------------------------------------------------------------
// Mock load-audio
// ---------------------------------------------------------------------------

jest.mock("./player/load-audio", () => ({
  findFirstSupportedFormat: jest.fn().mockReturnValue("ogg"),
  loadAudioBuffer: jest.fn(),
}));

import { loadAudioBuffer } from "./player/load-audio";
const mockLoadBuffer = loadAudioBuffer as jest.Mock;

// ---------------------------------------------------------------------------
// Minimal fake AudioContext (same pattern as smplr.test.ts)
// ---------------------------------------------------------------------------

function makeNode() {
  return {
    gain: {
      value: 1,
      setValueAtTime: jest.fn(),
      linearRampToValueAtTime: jest.fn(),
      cancelScheduledValues: jest.fn(),
    },
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
}

function makeContext() {
  return {
    currentTime: 0,
    destination: makeNode(),
    createGain: jest.fn(() => makeNode()),
    createBufferSource: jest.fn(() => ({
      buffer: null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      detune: { value: 0 },
      playbackRate: { value: 1 },
      onended: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    })),
    createBiquadFilter: jest.fn(() => ({
      type: "lowpass",
      frequency: { value: 20000 },
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
  };
}

function makeBuffer(): AudioBuffer {
  return { sampleRate: 44100, duration: 1 } as unknown as AudioBuffer;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadBuffer.mockResolvedValue(makeBuffer());
});

// ---------------------------------------------------------------------------
// spreadKeyRanges
// ---------------------------------------------------------------------------

describe("spreadKeyRanges", () => {
  it("returns empty array for empty input", () => {
    expect(spreadKeyRanges([])).toEqual([]);
  });

  it("single sample covers the full range [0, 127]", () => {
    const result = spreadKeyRanges([[60, "C4"]]);
    expect(result).toHaveLength(1);
    expect(result[0].keyRange).toEqual([0, 127]);
    expect(result[0].pitch).toBe(60);
    expect(result[0].sample).toBe("C4");
  });

  it("two samples split at floor((a+b)/2)", () => {
    // Samples at MIDI 23 and 27: midpoint = floor((23+27)/2) = 25
    const result = spreadKeyRanges([[23, "A"], [27, "B"]]);
    expect(result[0].keyRange).toEqual([0, 25]);   // 23 covers [0, 25]
    expect(result[1].keyRange).toEqual([26, 127]);  // 27 covers [26, 127]
  });

  it("ranges are contiguous — no gaps or overlaps", () => {
    // Use the first 5 samples from the PPP layer
    const samples = LAYERS[0].samples.slice(0, 5) as [number, string][];
    const result = spreadKeyRanges(samples);

    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].keyRange[1] + 1).toBe(result[i + 1].keyRange[0]);
    }
  });

  it("first range always starts at 0", () => {
    const samples = LAYERS[0].samples.slice(0, 3) as [number, string][];
    const result = spreadKeyRanges(samples);
    expect(result[0].keyRange[0]).toBe(0);
  });

  it("last range always ends at 127", () => {
    const samples = LAYERS[0].samples.slice(0, 3) as [number, string][];
    const result = spreadKeyRanges(samples);
    expect(result[result.length - 1].keyRange[1]).toBe(127);
  });

  it("sorts unsorted input before spreading", () => {
    // Supply in reverse order
    const result = spreadKeyRanges([[27, "B"], [23, "A"]]);
    expect(result[0].pitch).toBe(23);
    expect(result[1].pitch).toBe(27);
  });

  it("boundary matches findNearestMidi logic: notes ≤ mid go to lower sample", () => {
    // samples at 60 and 72; midpoint = floor((60+72)/2) = 66
    const result = spreadKeyRanges([[60, "C4"], [72, "C5"]]);
    // note 66 should be in the lower sample's range
    const [low, high] = result[0].keyRange;
    expect(low).toBe(0);
    expect(high).toBe(66);
    expect(result[1].keyRange[0]).toBe(67);
  });

  it("covers all 5 PPP samples with contiguous non-overlapping ranges", () => {
    const samples = LAYERS[0].samples as [number, string][];
    const result = spreadKeyRanges(samples);

    // All ranges must cover [0, 127] jointly
    expect(result[0].keyRange[0]).toBe(0);
    expect(result[result.length - 1].keyRange[1]).toBe(127);

    // Contiguous
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].keyRange[1] + 1).toBe(result[i + 1].keyRange[0]);
    }

    // Each pitch matches its input MIDI
    const pitches = result.map((r) => r.pitch);
    const inputMidis = samples.map(([m]) => m);
    expect(pitches).toEqual(inputMidis.sort((a, b) => a - b));
  });
});

// ---------------------------------------------------------------------------
// pianoToSmplrJson
// ---------------------------------------------------------------------------

describe("pianoToSmplrJson", () => {
  const BASE_OPTS = {
    baseUrl: "https://example.com/piano",
    detune: 0,
    decayTime: 0.5,
  };

  it("produces one group per layer (5 total)", () => {
    const json = pianoToSmplrJson(BASE_OPTS);
    expect(json.groups).toHaveLength(5);
  });

  it("groups have the correct velRanges matching LAYERS", () => {
    const json = pianoToSmplrJson(BASE_OPTS);
    LAYERS.forEach((layer, i) => {
      expect(json.groups[i].velRange).toEqual(layer.vel_range);
    });
  });

  it("PPP group has lpfCutoffHz = 1000", () => {
    const json = pianoToSmplrJson(BASE_OPTS);
    expect(json.groups[0].lpfCutoffHz).toBe(1000);
  });

  it("other groups do not have lpfCutoffHz", () => {
    const json = pianoToSmplrJson(BASE_OPTS);
    for (let i = 1; i < json.groups.length; i++) {
      expect(json.groups[i].lpfCutoffHz).toBeUndefined();
    }
  });

  it("sets defaults.ampRelease from decayTime", () => {
    const json = pianoToSmplrJson({ ...BASE_OPTS, decayTime: 1.2 });
    expect(json.defaults?.ampRelease).toBe(1.2);
  });

  it("sets defaults.detune from detune option", () => {
    const json = pianoToSmplrJson({ ...BASE_OPTS, detune: 50 });
    expect(json.defaults?.detune).toBe(50);
  });

  it("sets samples.baseUrl", () => {
    const json = pianoToSmplrJson(BASE_OPTS);
    expect(json.samples.baseUrl).toBe("https://example.com/piano");
  });

  it("sets samples.formats to ['ogg', 'm4a']", () => {
    const json = pianoToSmplrJson(BASE_OPTS);
    expect(json.samples.formats).toEqual(["ogg", "m4a"]);
  });

  it("each group has one region per sample with keyRange, pitch, sample", () => {
    const json = pianoToSmplrJson(BASE_OPTS);
    for (const group of json.groups) {
      for (const region of group.regions) {
        expect(region.keyRange).toBeDefined();
        expect(region.pitch).toBeDefined();
        expect(region.sample).toBeDefined();
      }
    }
  });

  it("regions in each group collectively cover [0, 127]", () => {
    const json = pianoToSmplrJson(BASE_OPTS);
    for (const group of json.groups) {
      const sorted = [...group.regions].sort(
        (a, b) => a.keyRange![0] - b.keyRange![0]
      );
      expect(sorted[0].keyRange![0]).toBe(0);
      expect(sorted[sorted.length - 1].keyRange![1]).toBe(127);
    }
  });

  describe("notesToLoad filtering", () => {
    it("filters to the layers matching the velocity range", () => {
      const json = pianoToSmplrJson({
        ...BASE_OPTS,
        notesToLoad: { notes: [60], velocityRange: [105, 127] },
      });
      // Only FF layer (101–127) matches
      expect(json.groups).toHaveLength(1);
      expect(json.groups[0].velRange).toEqual([101, 127]);
    });

    it("includes multiple layers when the range spans them", () => {
      const json = pianoToSmplrJson({
        ...BASE_OPTS,
        notesToLoad: { notes: [60], velocityRange: [1, 127] },
      });
      expect(json.groups).toHaveLength(5);
    });

    it("filters regions to only the requested MIDI notes", () => {
      const json = pianoToSmplrJson({
        ...BASE_OPTS,
        notesToLoad: { notes: [60, 72], velocityRange: [105, 127] },
      });
      // FF layer, only samples at midi 60 and 72
      expect(json.groups[0].regions).toHaveLength(2);
      const pitches = json.groups[0].regions.map((r) => r.pitch);
      expect(pitches.sort()).toEqual([60, 72]);
    });

    it("filtered regions still cover [0, 127] via spreadKeyRanges", () => {
      const json = pianoToSmplrJson({
        ...BASE_OPTS,
        notesToLoad: { notes: [60, 72], velocityRange: [105, 127] },
      });
      const regions = json.groups[0].regions.sort(
        (a, b) => a.keyRange![0] - b.keyRange![0]
      );
      expect(regions[0].keyRange![0]).toBe(0);
      expect(regions[regions.length - 1].keyRange![1]).toBe(127);
    });
  });
});

// ---------------------------------------------------------------------------
// SplendidGrandPiano integration
// ---------------------------------------------------------------------------

describe("SplendidGrandPiano", () => {
  it("load resolves with the piano instance", async () => {
    const ctx = makeContext();
    const piano = new SplendidGrandPiano(ctx as unknown as AudioContext);
    const result = await piano.load;
    expect(result).toBe(piano);
  });

  it("loadProgress is a LoadProgress object", async () => {
    const ctx = makeContext();
    const piano = new SplendidGrandPiano(ctx as unknown as AudioContext);
    await piano.load;
    expect(piano.loadProgress).toHaveProperty("loaded");
    expect(piano.loadProgress).toHaveProperty("total");
  });

  it("calls onLoadProgress during loading", async () => {
    const ctx = makeContext();
    const calls: number[] = [];
    await new SplendidGrandPiano(ctx as unknown as AudioContext, {
      onLoadProgress: ({ loaded }) => calls.push(loaded),
    }).load;
    expect(calls.length).toBeGreaterThan(0);
  });

  it("output has setVolume", () => {
    const ctx = makeContext();
    const piano = new SplendidGrandPiano(ctx as unknown as AudioContext);
    expect(typeof piano.output.setVolume).toBe("function");
  });

  it("start() returns a StopFn", async () => {
    const ctx = makeContext();
    const piano = await new SplendidGrandPiano(ctx as unknown as AudioContext).load;
    const stop = piano.start({ note: "C4", velocity: 50 });
    expect(typeof stop).toBe("function");
  });

  it("start() creates a voice for a note in range", async () => {
    const ctx = makeContext();
    const piano = await new SplendidGrandPiano(ctx as unknown as AudioContext).load;
    piano.start({ note: "C4", velocity: 50 });
    expect(ctx.createBufferSource).toHaveBeenCalled();
  });

  it("stop() does not throw", async () => {
    const ctx = makeContext();
    const piano = await new SplendidGrandPiano(ctx as unknown as AudioContext).load;
    piano.start({ note: "C4", velocity: 50 });
    expect(() => piano.stop()).not.toThrow();
  });

  it("disconnect() does not throw", async () => {
    const ctx = makeContext();
    const piano = await new SplendidGrandPiano(ctx as unknown as AudioContext).load;
    expect(() => piano.disconnect()).not.toThrow();
  });

  it("uses the provided baseUrl for sample loading", async () => {
    const ctx = makeContext();
    const piano = new SplendidGrandPiano(ctx as unknown as AudioContext, {
      baseUrl: "https://custom.example.com/piano",
    });
    await piano.load;

    const calls = mockLoadBuffer.mock.calls as [unknown, string][];
    expect(calls.every(([, url]) => url.startsWith("https://custom.example.com/piano/"))).toBe(true);
  });

  it("notesToLoad limits the number of buffers fetched", async () => {
    const ctx = makeContext();
    await new SplendidGrandPiano(ctx as unknown as AudioContext, {
      notesToLoad: { notes: [60], velocityRange: [105, 127] },
    }).load;

    // Only FF layer, only MIDI 60 — should fetch exactly 1 buffer
    expect(mockLoadBuffer).toHaveBeenCalledTimes(1);
  });
});
