import { Smplr } from "./smplr";
import { SmplrJson } from "./types";

// ---------------------------------------------------------------------------
// Mock load-audio (no real HTTP or Web Audio decoding)
// ---------------------------------------------------------------------------

jest.mock("../player/load-audio", () => ({
  findFirstSupportedFormat: jest.fn().mockReturnValue("ogg"),
  loadAudioBuffer: jest.fn(),
}));

import { loadAudioBuffer } from "../player/load-audio";
const mockLoadBuffer = loadAudioBuffer as jest.Mock;

// ---------------------------------------------------------------------------
// Minimal fake AudioContext
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

type FakeSource = {
  buffer: AudioBuffer | null;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  detune: { value: number };
  playbackRate: { value: number };
  onended: (() => void) | null;
  connect: jest.Mock;
  disconnect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
};

function makeContext(currentTime = 0) {
  const sources: FakeSource[] = [];

  function makeSource(): FakeSource {
    const source: FakeSource = {
      buffer: null as AudioBuffer | null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      detune: { value: 0 },
      playbackRate: { value: 1 },
      onended: null as (() => void) | null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
    sources.push(source);
    return source;
  }

  const ctx = {
    currentTime,
    destination: makeNode(),
    createGain: jest.fn(() => makeNode()),
    createBufferSource: jest.fn(() => makeSource()),
    createBiquadFilter: jest.fn(() => ({
      type: "lowpass",
      frequency: { value: 20000 },
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
    _sources: sources,
  };
  return ctx;
}

type FakeContext = ReturnType<typeof makeContext>;

function makeBuffer(): AudioBuffer {
  return { sampleRate: 44100, duration: 1 } as unknown as AudioBuffer;
}

// ---------------------------------------------------------------------------
// Shared test fixture
// ---------------------------------------------------------------------------

/** SmplrJson with one group, one region keyed to MIDI 60 (C4). */
function makeJson(overrides?: Partial<SmplrJson>): SmplrJson {
  return {
    samples: { baseUrl: "https://example.com", formats: ["ogg"] },
    groups: [{ regions: [{ sample: "C4", key: 60 }] }],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockLoadBuffer.mockResolvedValue(makeBuffer());
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// load promise
// ---------------------------------------------------------------------------

describe("load", () => {
  it("resolves with the Smplr instance", async () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    const result = await smplr.load;
    expect(result).toBe(smplr);
  });

  it("load is a Promise", () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    expect(smplr.load).toBeInstanceOf(Promise);
  });
});

// ---------------------------------------------------------------------------
// loadProgress
// ---------------------------------------------------------------------------

describe("loadProgress", () => {
  it("starts at { loaded: 0, total: 0 }", () => {
    // Make loadAudioBuffer never resolve during this check
    mockLoadBuffer.mockReturnValue(new Promise(() => {}));
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    expect(smplr.loadProgress).toEqual({ loaded: 0, total: 0 });
  });

  it("updates as each buffer loads", async () => {
    const ctx = makeContext();
    const snapshots: { loaded: number; total: number }[] = [];
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson(), {
      onLoadProgress: (p) => snapshots.push({ ...p }),
    });
    await smplr.load;
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toEqual({ loaded: 1, total: 1 });
  });

  it("reflects latest progress after load", async () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;
    expect(smplr.loadProgress).toEqual({ loaded: 1, total: 1 });
  });

  it("calls onLoadProgress for each unique sample", async () => {
    const json: SmplrJson = {
      samples: { baseUrl: "https://example.com", formats: ["ogg"] },
      groups: [
        { regions: [{ sample: "C4", key: 60 }, { sample: "D4", key: 62 }] },
      ],
    };
    const ctx = makeContext();
    const calls: number[] = [];
    const smplr = new Smplr(ctx as unknown as AudioContext, json, {
      onLoadProgress: ({ loaded }) => calls.push(loaded),
    });
    await smplr.load;
    expect(calls).toHaveLength(2);
    expect(calls.sort()).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// output channel
// ---------------------------------------------------------------------------

describe("output", () => {
  it("exposes an output channel with setVolume", () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    expect(typeof smplr.output.setVolume).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// start() — voice creation
// ---------------------------------------------------------------------------

describe("start()", () => {
  it("creates an AudioBufferSourceNode when the note matches a region", async () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    smplr.start({ note: "C4" });

    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1);
  });

  it("starts the source node", async () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    smplr.start({ note: "C4" });

    expect(ctx._sources[0].start).toHaveBeenCalledTimes(1);
  });

  it("accepts a bare note name string", async () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    smplr.start("C4");

    expect(ctx._sources[0].start).toHaveBeenCalledTimes(1);
  });

  it("accepts a bare MIDI number", async () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    smplr.start(60);

    expect(ctx._sources[0].start).toHaveBeenCalledTimes(1);
  });

  it("does not create a voice if no buffer is loaded for the sample", async () => {
    mockLoadBuffer.mockResolvedValue(undefined);
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    smplr.start({ note: "C4" });

    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it("does not create a voice when note doesn't match any region", async () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    smplr.start({ note: "G9" }); // MIDI 127+, out of range key=60

    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it("returns a StopFn", async () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    const stop = smplr.start({ note: "C4" });

    expect(typeof stop).toBe("function");
  });

  it("StopFn stops the voice", async () => {
    const ctx = makeContext() as FakeContext;
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    const stop = smplr.start({ note: "C4" });
    stop();

    // Source node should be stopped (stop() triggers the release envelope path)
    expect(ctx._sources[0].stop).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// start() — future scheduling
// ---------------------------------------------------------------------------

describe("start() with future time", () => {
  it("does not create a voice immediately for a future-timed note", async () => {
    const ctx = makeContext(0) as any;
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    smplr.start({ note: "C4", time: 1.0 }); // 1 second in the future

    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it("StopFn cancels a queued note before it plays", async () => {
    const ctx = makeContext(0) as any;
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    const stop = smplr.start({ note: "C4", time: 1.0 });
    stop(); // cancel before the scheduler tick

    ctx.currentTime = 0.9;
    jest.advanceTimersByTime(50);

    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// stop()
// ---------------------------------------------------------------------------

describe("stop()", () => {
  it("stop() with no args stops all active voices", async () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    smplr.start({ note: "C4" });
    smplr.start({ note: "C4" }); // second voice same note
    smplr.stop();

    ctx._sources.forEach((src) => expect(src.stop).toHaveBeenCalled());
  });

  it("stop(string) stops voices matching that stopId", async () => {
    const ctx = makeContext();
    const json: SmplrJson = {
      samples: { baseUrl: "https://example.com", formats: ["ogg"] },
      groups: [
        {
          regions: [
            { sample: "C4", key: 60 },
            { sample: "D4", key: 62 },
          ],
        },
      ],
    };
    mockLoadBuffer.mockResolvedValue(makeBuffer());
    const smplr = new Smplr(ctx as unknown as AudioContext, json);
    await smplr.load;

    smplr.start({ note: "C4", stopId: "C4" });
    smplr.start({ note: "D4", stopId: "D4" });
    smplr.stop("C4");

    // Only the C4 source should be stopped
    expect(ctx._sources[0].stop).toHaveBeenCalled();
    expect(ctx._sources[1].stop).not.toHaveBeenCalled();
  });

  it("stop({ stopId, time }) stops by id at a future time", async () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    smplr.start({ note: "C4", stopId: "myNote" });
    smplr.stop({ stopId: "myNote", time: 1.5 });

    // stop() should have been called on the source (with scheduled time)
    expect(ctx._sources[0].stop).toHaveBeenCalled();
  });

  it("stop({ time }) with no stopId stops all voices", async () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    smplr.start({ note: "C4" });
    smplr.stop({ time: 1.0 });

    expect(ctx._sources[0].stop).toHaveBeenCalled();
  });

  it("stop() is safe when no voices are active", () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    expect(() => smplr.stop()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// disconnect()
// ---------------------------------------------------------------------------

describe("disconnect()", () => {
  it("stops all active voices", async () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    smplr.start({ note: "C4" });
    smplr.disconnect();

    expect(ctx._sources[0].stop).toHaveBeenCalled();
  });

  it("is safe to call when no voices are active", () => {
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    expect(() => smplr.disconnect()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Shared SampleLoader (cache)
// ---------------------------------------------------------------------------

describe("shared SampleLoader", () => {
  it("uses the cached buffer on the second instance", async () => {
    const { SampleLoader } = await import("./sample-loader");
    const ctx = makeContext();
    const loader = new SampleLoader(ctx as unknown as BaseAudioContext);

    // Load smplr1 first to warm the cache
    const smplr1 = new Smplr(ctx as unknown as AudioContext, makeJson(), { loader });
    await smplr1.load;

    // smplr2 uses the same loader — cache is already warm
    const smplr2 = new Smplr(ctx as unknown as AudioContext, makeJson(), { loader });
    await smplr2.load;

    // loadAudioBuffer only called once; second load hit the cache
    expect(mockLoadBuffer).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// duration auto-stop
// ---------------------------------------------------------------------------

describe("duration", () => {
  it("auto-stops the voice after the specified duration", async () => {
    jest.useRealTimers(); // use real timers for this test
    const ctx = makeContext();
    const smplr = new Smplr(ctx as unknown as AudioContext, makeJson());
    await smplr.load;

    smplr.start({ note: "C4", duration: 0.01 });

    await new Promise((r) => setTimeout(r, 50)); // wait for auto-stop
    expect(ctx._sources[0].stop).toHaveBeenCalled();
  });
});
