import { Scheduler } from "./scheduler";
import { SmplrImpl } from "./smplr";
import { VoiceManager } from "./voice-manager";
import { Voice } from "./voice";
import { SmplrPreset } from "./types";

// ---------------------------------------------------------------------------
// Mock load-audio (no real HTTP or Web Audio decoding)
// ---------------------------------------------------------------------------

jest.mock("./load-audio", () => ({
  findFirstSupportedFormat: jest.fn().mockReturnValue("ogg"),
  loadAudioBuffer: jest.fn(),
}));

import { loadAudioBuffer } from "./load-audio";
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
    createStereoPanner: jest.fn(() => ({
      pan: { value: 0 },
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

/** SmplrPreset with one group, one region keyed to MIDI 60 (C4). */
function makeJson(overrides?: Partial<SmplrPreset>): SmplrPreset {
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
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    const result = await smplr.load; // deprecation-ok: verifies the .load alias resolves to the instance
    expect(result).toBe(smplr);
  });

  it("load is a Promise", () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    expect(smplr.load).toBeInstanceOf(Promise); // deprecation-ok: verifies the .load alias
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
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    expect(smplr.loadProgress).toEqual({ loaded: 0, total: 0 });
  });

  it("updates as each buffer loads", async () => {
    const ctx = makeContext();
    const snapshots: { loaded: number; total: number }[] = [];
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson(), {
      onLoadProgress: (p) => snapshots.push({ ...p }),
    });
    await smplr.ready;
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toEqual({ loaded: 1, total: 1 });
  });

  it("reflects latest progress after load", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;
    expect(smplr.loadProgress).toEqual({ loaded: 1, total: 1 });
  });

  it("calls onLoadProgress for each unique sample", async () => {
    const json: SmplrPreset = {
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
    const ctx = makeContext();
    const calls: number[] = [];
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, json, {
      onLoadProgress: ({ loaded }) => calls.push(loaded),
    });
    await smplr.ready;
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
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    expect(typeof smplr.output.setVolume).toBe("function"); // deprecation-ok: verifies the setVolume alias
  });
});

// ---------------------------------------------------------------------------
// start() — voice creation
// ---------------------------------------------------------------------------

describe("start()", () => {
  it("creates an AudioBufferSourceNode when the note matches a region", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start({ note: "C4" });

    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1);
  });

  it("starts the source node", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start({ note: "C4" });

    expect(ctx._sources[0].start).toHaveBeenCalledTimes(1);
  });

  it("accepts a bare note name string", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start("C4");

    expect(ctx._sources[0].start).toHaveBeenCalledTimes(1);
  });

  it("accepts a bare MIDI number", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start(60);

    expect(ctx._sources[0].start).toHaveBeenCalledTimes(1);
  });

  it("does not create a voice if no buffer is loaded for the sample", async () => {
    mockLoadBuffer.mockResolvedValue(undefined);
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start({ note: "C4" });

    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it("does not create a voice when note doesn't match any region", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start({ note: "G9" }); // MIDI 127+, out of range key=60

    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it("returns a StopFn", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    const stop = smplr.start({ note: "C4" });

    expect(typeof stop).toBe("function");
  });

  it("StopFn stops the voice", async () => {
    const ctx = makeContext() as FakeContext;
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    const stop = smplr.start({ note: "C4" });
    stop();

    // Source node should be stopped (stop() triggers the release envelope path)
    expect(ctx._sources[0].stop).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// start() — NoteHandle
// ---------------------------------------------------------------------------

describe("NoteHandle", () => {
  let fadeSpy: jest.SpyInstance;
  let glideSpy: jest.SpyInstance;

  beforeEach(() => {
    fadeSpy = jest
      .spyOn(Voice.prototype, "fadeTo")
      .mockImplementation(function (this: Voice) {});
    glideSpy = jest
      .spyOn(Voice.prototype, "glideTo")
      .mockImplementation(function (this: Voice) {});
  });

  afterEach(() => {
    fadeSpy.mockRestore();
    glideSpy.mockRestore();
  });

  async function setup(json = makeJson(), currentTime = 0) {
    const ctx = makeContext(currentTime) as FakeContext;
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, json);
    await smplr.ready;
    return { ctx, smplr };
  }

  it("exposes stopId and counts the voices of the call", async () => {
    const { smplr } = await setup();
    const note = smplr.start({ note: "C4" });
    expect(note.stopId).toBe("C4");
    expect(note.voiceCount).toBe(1);
  });

  it("fadeTo and glideTo reach the voices of the call, with now as default time", async () => {
    const { smplr } = await setup(makeJson(), 0.5);
    const note = smplr.start({ note: "C4" });

    note.fadeTo(-6, 1).glideTo(2, 0.1, 3);

    expect(fadeSpy).toHaveBeenCalledWith(-6, 1, 0.5);
    expect(glideSpy).toHaveBeenCalledWith(2, 0.1, 3);
  });

  it("only affects the voices of its own start() call", async () => {
    const { smplr } = await setup();
    const first = smplr.start({ note: "C4" });
    const second = smplr.start({ note: "C4" });

    first.fadeTo(-12, 1);

    expect(fadeSpy).toHaveBeenCalledTimes(1);
    const target = fadeSpy.mock.instances[0];
    expect(first.voiceCount).toBe(1);
    expect(second.voiceCount).toBe(1);
    second.fadeTo(-3, 1);
    expect(fadeSpy.mock.instances[1]).not.toBe(target);
  });

  it("calling the handle keeps stopping every voice with its stopId", async () => {
    const { ctx, smplr } = await setup();
    const first = smplr.start({ note: "C4" });
    smplr.start({ note: "C4" });

    first();

    expect(ctx._sources[0].stop).toHaveBeenCalled();
    expect(ctx._sources[1].stop).toHaveBeenCalled();
  });

  it("handle.stop() is the same as calling it", async () => {
    const { ctx, smplr } = await setup();
    smplr.start({ note: "C4" }).stop();
    expect(ctx._sources[0].stop).toHaveBeenCalled();
  });

  it("reaches every layered voice of one call", async () => {
    const { smplr } = await setup(
      makeJson({
        groups: [
          { regions: [{ sample: "C4", key: 60 }] },
          { regions: [{ sample: "C4b", key: 60 }] },
        ],
      }),
    );
    const note = smplr.start({ note: "C4" });

    note.glideTo(-12, 1);

    expect(note.voiceCount).toBe(2);
    expect(glideSpy).toHaveBeenCalledTimes(2);
  });

  it("queues operations on a scheduled note and applies them when it starts", async () => {
    const { ctx, smplr } = await setup();
    const note = smplr.start({ note: "C4", time: 1 });

    note.fadeTo(-6, 0.5);
    expect(fadeSpy).not.toHaveBeenCalled();
    expect(note.voiceCount).toBe(0);

    ctx.currentTime = 0.9;
    jest.advanceTimersByTime(50);

    expect(note.voiceCount).toBe(1);
    // Requested at time 0; Voice clamps it to its start time
    expect(fadeSpy).toHaveBeenCalledWith(-6, 0.5, 0);
  });

  it("forgets voices once they end", async () => {
    const { ctx, smplr } = await setup();
    const note = smplr.start({ note: "C4" });

    ctx._sources[0].onended?.();

    expect(note.voiceCount).toBe(0);
    note.fadeTo(-6, 1);
    expect(fadeSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// start() — future scheduling
// ---------------------------------------------------------------------------

describe("start() with future time", () => {
  it("does not create a voice immediately for a future-timed note", async () => {
    const ctx = makeContext(0) as any;
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start({ note: "C4", time: 1.0 }); // 1 second in the future

    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it("StopFn cancels a queued note before it plays", async () => {
    const ctx = makeContext(0) as any;
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

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
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start({ note: "C4" });
    smplr.start({ note: "C4" }); // second voice same note
    smplr.stop();

    ctx._sources.forEach((src) => expect(src.stop).toHaveBeenCalled());
  });

  it("stop(string) stops voices matching that stopId", async () => {
    const ctx = makeContext();
    const json: SmplrPreset = {
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
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, json);
    await smplr.ready;

    smplr.start({ note: "C4", stopId: "C4" });
    smplr.start({ note: "D4", stopId: "D4" });
    smplr.stop("C4");

    // Only the C4 source should be stopped
    expect(ctx._sources[0].stop).toHaveBeenCalled();
    expect(ctx._sources[1].stop).not.toHaveBeenCalled();
  });

  it("stop({ stopId, time }) stops by id at a future time", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start({ note: "C4", stopId: "myNote" });
    smplr.stop({ stopId: "myNote", time: 1.5 });

    // stop() should have been called on the source (with scheduled time)
    expect(ctx._sources[0].stop).toHaveBeenCalled();
  });

  it("stop({ time }) with no stopId stops all voices", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start({ note: "C4" });
    smplr.stop({ time: 1.0 });

    expect(ctx._sources[0].stop).toHaveBeenCalled();
  });

  it("stop() is safe when no voices are active", () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    expect(() => smplr.stop()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// stop() — notes scheduled beyond the lookahead
// ---------------------------------------------------------------------------

describe("stop() cancels scheduled notes", () => {
  /** Preset with C4 and D4 regions. */
  const twoNotes = (): SmplrPreset => ({
    samples: { baseUrl: "https://example.com", formats: ["ogg"] },
    groups: [
      {
        regions: [
          { sample: "C4", key: 60 },
          { sample: "D4", key: 62 },
        ],
      },
    ],
  });

  /** Move the clock and let the scheduler interval dispatch due notes. */
  function advanceTo(ctx: FakeContext, time: number) {
    ctx.currentTime = time;
    jest.advanceTimersByTime(50);
  }

  async function setup(options?: { scheduler?: Scheduler }) {
    const ctx = makeContext(0);
    const started: Array<string | number> = [];
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, twoNotes(), {
      ...options,
      onStart: (e) => started.push(typeof e === "object" ? e.note : e),
    });
    await smplr.ready;
    return { ctx, smplr, started };
  }

  it("stop() cancels every note scheduled for later", async () => {
    const { ctx, smplr } = await setup();
    for (let i = 1; i <= 8; i++) smplr.start({ note: "C4", time: i });

    smplr.stop();
    for (let t = 0; t <= 9; t += 0.5) advanceTo(ctx, t);

    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it("stop() stops the sounding notes and cancels the later ones", async () => {
    const { ctx, smplr, started } = await setup();
    smplr.start({ note: "C4" });
    smplr.start({ note: "D4", time: 2 });

    smplr.stop();
    advanceTo(ctx, 2);

    expect(started).toEqual(["C4"]);
    expect(ctx._sources[0].stop).toHaveBeenCalled();
  });

  it("stop(stopId) cancels only the scheduled notes with that stopId", async () => {
    const { ctx, smplr, started } = await setup();
    smplr.start({ note: "C4", time: 1 });
    smplr.start({ note: "D4", time: 1.5 });
    smplr.start({ note: "C4", time: 2 });

    smplr.stop("C4");
    for (let t = 1; t <= 2.5; t += 0.5) advanceTo(ctx, t);

    expect(started).toEqual(["D4"]);
  });

  it("stop({ stopId }) cancels the scheduled notes with that stopId", async () => {
    const { ctx, smplr, started } = await setup();
    smplr.start({ note: "C4", time: 1, stopId: "melody" });
    smplr.start({ note: "D4", time: 1 });

    smplr.stop({ stopId: "melody" });
    advanceTo(ctx, 1);

    expect(started).toEqual(["D4"]);
  });

  it("stop({ time }) keeps the scheduled notes that start before time", async () => {
    const { ctx, smplr, started } = await setup();
    smplr.start({ note: "C4", time: 1 });
    smplr.start({ note: "D4", time: 2 });
    smplr.start({ note: "C4", time: 3 });

    smplr.stop({ time: 2 });
    for (let t = 1; t <= 3.5; t += 0.5) advanceTo(ctx, t);

    expect(started).toEqual(["C4"]);
  });

  it("stop({ stopId, time }) cancels the notes with that stopId from time on", async () => {
    const { ctx, smplr, started } = await setup();
    smplr.start({ note: "C4", time: 1 });
    smplr.start({ note: "C4", time: 3 });
    smplr.start({ note: "D4", time: 3 });

    smplr.stop({ stopId: "C4", time: 2 });
    for (let t = 1; t <= 3.5; t += 0.5) advanceTo(ctx, t);

    expect(started).toEqual(["C4", "D4"]);
  });

  it("stop() still stops a scheduled note after it is dispatched", async () => {
    const { ctx, smplr, started } = await setup();
    smplr.start({ note: "C4", time: 1 });
    advanceTo(ctx, 1);
    expect(started).toEqual(["C4"]);

    smplr.stop();
    expect(ctx._sources[0].stop).toHaveBeenCalled();
  });

  it("start() can schedule notes again after stop()", async () => {
    const { ctx, smplr, started } = await setup();
    smplr.start({ note: "C4", time: 1 });
    smplr.stop();
    smplr.start({ note: "D4", time: 2 });
    for (let t = 1; t <= 2; t += 0.5) advanceTo(ctx, t);

    expect(started).toEqual(["D4"]);
  });

  describe("shared scheduler", () => {
    async function setupShared() {
      const ctx = makeContext(0);
      const scheduler = Scheduler(ctx as unknown as AudioContext);
      const startedA: Array<string | number> = [];
      const startedB: Array<string | number> = [];
      const record = (list: Array<string | number>) => (e: unknown) =>
        list.push((e as { note: string }).note);
      const a = new SmplrImpl(ctx as unknown as AudioContext, twoNotes(), {
        scheduler,
        onStart: record(startedA),
      });
      const b = new SmplrImpl(ctx as unknown as AudioContext, twoNotes(), {
        scheduler,
        onStart: record(startedB),
      });
      await Promise.all([a.ready, b.ready]);
      return { ctx, scheduler, a, b, startedA, startedB };
    }

    it("stop() of one instrument doesn't cancel the other's notes", async () => {
      const { ctx, a, b, startedA, startedB } = await setupShared();
      a.start({ note: "C4", time: 1 });
      b.start({ note: "C4", time: 1 });

      a.stop();
      advanceTo(ctx, 1);

      expect(startedA).toEqual([]);
      expect(startedB).toEqual(["C4"]);
    });

    it("dispose() of one instrument doesn't cancel the other's notes", async () => {
      const { ctx, scheduler, a, b, startedA, startedB } = await setupShared();
      const stopSpy = jest.spyOn(scheduler, "stop");
      a.start({ note: "C4", time: 1 });
      b.start({ note: "D4", time: 1 });

      a.dispose();
      advanceTo(ctx, 1);

      expect(stopSpy).not.toHaveBeenCalled();
      expect(startedA).toEqual([]);
      expect(startedB).toEqual(["D4"]);
    });
  });
});

// ---------------------------------------------------------------------------
// dispose()
// ---------------------------------------------------------------------------

describe("dispose()", () => {
  it("stops all active voices", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start({ note: "C4" });
    smplr.dispose();

    expect(ctx._sources[0].stop).toHaveBeenCalled();
  });

  it("cancels the notes scheduled for later", async () => {
    const ctx = makeContext(0);
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start({ note: "C4", time: 1 });
    smplr.dispose();
    ctx.currentTime = 1;
    jest.advanceTimersByTime(50);

    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it("is safe to call when no voices are active", () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    expect(() => smplr.dispose()).not.toThrow();
  });

  it("is idempotent — calling dispose() twice is a no-op", () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    smplr.dispose();
    expect(() => smplr.dispose()).not.toThrow();
  });

  it("disconnect() alias delegates to the same teardown", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    const stopSpy = jest.spyOn(smplr.scheduler, "stop");
    await smplr.ready;

    smplr.disconnect(); // deprecation-ok: verifies the disconnect alias delegates to dispose
    expect(stopSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Shared SampleLoader (cache)
// ---------------------------------------------------------------------------

describe("shared SampleLoader", () => {
  it("uses the cached buffer on the second instance", async () => {
    const { SampleLoader } = await import("./sample-loader");
    const ctx = makeContext();
    const loader = SampleLoader(ctx as unknown as BaseAudioContext);

    // Load smplr1 first to warm the cache
    const smplr1 = new SmplrImpl(ctx as unknown as AudioContext, makeJson(), {
      loader,
    });
    await smplr1.ready;

    // smplr2 uses the same loader — cache is already warm
    const smplr2 = new SmplrImpl(ctx as unknown as AudioContext, makeJson(), {
      loader,
    });
    await smplr2.ready;

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
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start({ note: "C4", duration: 0.01 });

    await new Promise((r) => setTimeout(r, 50)); // wait for auto-stop
    expect(ctx._sources[0].stop).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onStart / onEnded callbacks
// ---------------------------------------------------------------------------

describe("onStart", () => {
  it("global onStart is called when a note is dispatched", async () => {
    const ctx = makeContext();
    const onStart = jest.fn();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson(), {
      onStart,
    });
    await smplr.ready;

    smplr.start({ note: "C4" });

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("per-note onStart is called", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    const onStart = jest.fn();
    smplr.start({ note: "C4", onStart });

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("global and per-note onStart are both called", async () => {
    const ctx = makeContext();
    const globalOnStart = jest.fn();
    const perNoteOnStart = jest.fn();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson(), {
      onStart: globalOnStart,
    });
    await smplr.ready;

    smplr.start({ note: "C4", onStart: perNoteOnStart });

    expect(globalOnStart).toHaveBeenCalledTimes(1);
    expect(perNoteOnStart).toHaveBeenCalledTimes(1);
  });

  it("onStart fires once even when multiple regions match", async () => {
    const ctx = makeContext();
    const json = makeJson({
      groups: [
        {
          regions: [
            { sample: "C4", key: 60 },
            { sample: "C4", key: 60 }, // second region — same note, two voices
          ],
        },
      ],
    });
    mockLoadBuffer.mockResolvedValue(makeBuffer());
    const onStart = jest.fn();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, json, {
      onStart,
    });
    await smplr.ready;

    smplr.start({ note: "C4" });

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("onStart receives the note event", async () => {
    const ctx = makeContext();
    const onStart = jest.fn();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson(), {
      onStart,
    });
    await smplr.ready;

    smplr.start({ note: "C4", velocity: 80 });

    const received = onStart.mock.calls[0][0];
    expect(received.note).toBe("C4");
    expect(received.velocity).toBe(80);
  });

  it("onStart is not called when no region matches", async () => {
    const ctx = makeContext();
    const onStart = jest.fn();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson(), {
      onStart,
    });
    await smplr.ready;

    smplr.start({ note: "D4" }); // no region for D4

    expect(onStart).not.toHaveBeenCalled();
  });
});

describe("onEnded", () => {
  it("global onEnded is called when a voice ends", async () => {
    const ctx = makeContext();
    const onEnded = jest.fn();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson(), {
      onEnded,
    });
    await smplr.ready;

    smplr.start({ note: "C4" });
    ctx._sources[0].onended?.(); // simulate audio node ending

    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("per-note onEnded is called when the voice ends", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    const onEnded = jest.fn();
    smplr.start({ note: "C4", onEnded });
    ctx._sources[0].onended?.();

    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("global and per-note onEnded are both called", async () => {
    const ctx = makeContext();
    const globalOnEnded = jest.fn();
    const perNoteOnEnded = jest.fn();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson(), {
      onEnded: globalOnEnded,
    });
    await smplr.ready;

    smplr.start({ note: "C4", onEnded: perNoteOnEnded });
    ctx._sources[0].onended?.();

    expect(globalOnEnded).toHaveBeenCalledTimes(1);
    expect(perNoteOnEnded).toHaveBeenCalledTimes(1);
  });

  it("onEnded fires once per matched voice", async () => {
    const ctx = makeContext();
    const json = makeJson({
      groups: [
        {
          regions: [
            { sample: "C4", key: 60 },
            { sample: "C4", key: 60 }, // two matching regions → two voices
          ],
        },
      ],
    });
    mockLoadBuffer.mockResolvedValue(makeBuffer());
    const onEnded = jest.fn();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, json, {
      onEnded,
    });
    await smplr.ready;

    smplr.start({ note: "C4" });
    ctx._sources[0].onended?.();
    ctx._sources[1].onended?.();

    expect(onEnded).toHaveBeenCalledTimes(2);
  });

  it("onEnded is not called before the voice ends", async () => {
    const ctx = makeContext();
    const onEnded = jest.fn();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson(), {
      onEnded,
    });
    await smplr.ready;

    smplr.start({ note: "C4" });

    expect(onEnded).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// setDetune / setReverse
// ---------------------------------------------------------------------------

describe("setDetune / setReverse", () => {
  it("setDetune applies to notes scheduled after the call", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.setDetune(50);
    smplr.start({ note: "C4" });

    expect(ctx._sources[0].detune.value).toBe(50);
  });

  it("setDetune mutates defaults on subsequent calls", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.setDetune(100);
    smplr.start({ note: "C4" });
    expect(ctx._sources[0].detune.value).toBe(100);

    smplr.setDetune(-50);
    smplr.start({ note: "C4" });
    expect(ctx._sources[1].detune.value).toBe(-50);
  });

  it("setReverse(true) uses the reversed buffer for future notes", async () => {
    const ctx = makeContext();
    const original = {
      numberOfChannels: 1,
      length: 4,
      sampleRate: 44100,
      getChannelData: jest.fn(() => new Float32Array([1, 2, 3, 4])),
    } as unknown as AudioBuffer;

    const ctxWithCreate = ctx as unknown as { createBuffer: jest.Mock };
    ctxWithCreate.createBuffer = jest.fn(
      (channels: number, length: number, sampleRate: number) => {
        const data: Float32Array[] = [];
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          copyToChannel: (arr: Float32Array, ch: number) => {
            data[ch] = arr;
          },
          getChannelData: (ch: number) => data[ch],
        } as unknown as AudioBuffer;
      },
    );

    const smplr = new SmplrImpl(ctx as unknown as AudioContext);
    await smplr.loadInstrument(makeJson(), new Map([["C4", original]]));

    smplr.setReverse(true);
    smplr.start({ note: "C4" });

    expect(ctxWithCreate.createBuffer).toHaveBeenCalledTimes(1);
  });

  it("setReverse(false) restores forward playback", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.setReverse(true);
    smplr.setReverse(false);
    smplr.start({ note: "C4" });

    // Source's buffer is the forward (non-reversed) buffer
    expect(ctx._sources[0].buffer).toBeDefined();
  });

  it("setDetune after dispose throws", () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    smplr.dispose();
    expect(() => smplr.setDetune(50)).toThrow(/disposed/);
  });

  it("setReverse after dispose throws", () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    smplr.dispose();
    expect(() => smplr.setReverse(true)).toThrow(/disposed/);
  });

  it("setDetune works before loadInstrument (Pattern B)", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext);
    smplr.setDetune(75);
    await smplr.loadInstrument(makeJson());

    // After loadInstrument, the previous setDetune is overridden by the
    // new instrument's defaults (per loadInstrument's documented atomic swap).
    // This test just verifies the call doesn't throw pre-load.
    smplr.start({ note: "C4" });
    expect(ctx._sources).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Pattern B: new SmplrImpl(ctx, opts) + loadInstrument(json)
// ---------------------------------------------------------------------------

describe("Pattern B: new SmplrImpl(ctx, opts) + loadInstrument(json)", () => {
  it("constructs with options only; ready resolves immediately", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, { volume: 80 });
    await expect(smplr.ready).resolves.toBeUndefined();
    expect(smplr.loadProgress.total).toBe(0);
  });

  it("loadInstrument populates the instrument data", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext);
    await smplr.loadInstrument(makeJson());
    expect(smplr.loadProgress.total).toBeGreaterThan(0);

    const stop = smplr.start({ note: "C4" });
    expect(typeof stop).toBe("function");
  });

  it("loadInstrument can be called multiple times to replace the instrument data", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext);
    await smplr.loadInstrument(makeJson());
    await smplr.loadInstrument(makeJson());
    expect(smplr.loadProgress.total).toBeGreaterThan(0);
  });

  it("loadInstrument with buffers map uses provided buffers", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext);
    const buffer = makeBuffer();
    const buffers = new Map<string, AudioBuffer>([["C4", buffer]]);
    await smplr.loadInstrument(makeJson(), buffers);

    const stop = smplr.start({ note: "C4" });
    expect(typeof stop).toBe("function");
  });

  it("setCC before loadInstrument is preserved after load", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext);
    smplr.setCC(64, 100);
    await smplr.loadInstrument(makeJson());
    expect(smplr.getCC(64)).toBe(100);
  });

  it("start() before loadInstrument is a safe no-op", () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext);
    const stop = smplr.start({ note: "C4" });
    expect(typeof stop).toBe("function");
  });

  it("loadInstrument concurrent calls: latest wins regardless of resolution order", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext);
    const bufferA = makeBuffer();
    const bufferB = makeBuffer();

    const jsonA: SmplrPreset = {
      samples: { baseUrl: "https://example.com", formats: ["ogg"] },
      groups: [{ regions: [{ sample: "A", key: 60 }] }],
    };
    const jsonB: SmplrPreset = {
      samples: { baseUrl: "https://example.com", formats: ["ogg"] },
      groups: [{ regions: [{ sample: "B", key: 62 }] }],
    };

    // Resolve order matches call order (A first, then B); B is the latest call
    // and should be the active instrument afterwards.
    mockLoadBuffer.mockImplementation((_ctx: unknown, url: string) => {
      if (url.includes("/A.")) return Promise.resolve(bufferA);
      if (url.includes("/B.")) return Promise.resolve(bufferB);
      return Promise.resolve(makeBuffer());
    });

    const p1 = smplr.loadInstrument(jsonA);
    const p2 = smplr.loadInstrument(jsonB);
    await Promise.all([p1, p2]);

    // Active instrument is B: matching B's region (MIDI 62) creates a voice.
    smplr.start({ note: 62 });
    expect(ctx._sources).toHaveLength(1);
    expect(ctx._sources[0].buffer).toBe(bufferB);

    // A's region (MIDI 60) is no longer matched.
    smplr.start({ note: 60 });
    expect(ctx._sources).toHaveLength(1);
  });

  it("loadInstrument state swap is atomic: start() during load uses previous instrument", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext);
    const bufferA = makeBuffer();
    const bufferB = makeBuffer();

    const jsonA: SmplrPreset = {
      samples: { baseUrl: "https://example.com", formats: ["ogg"] },
      groups: [{ regions: [{ sample: "A", key: 60 }] }],
    };
    const jsonB: SmplrPreset = {
      samples: { baseUrl: "https://example.com", formats: ["ogg"] },
      groups: [{ regions: [{ sample: "B", key: 60 }] }],
    };

    mockLoadBuffer.mockImplementation((_ctx: unknown, url: string) => {
      if (url.includes("/A.")) return Promise.resolve(bufferA);
      if (url.includes("/B.")) return Promise.resolve(bufferB);
      return Promise.resolve(makeBuffer());
    });

    await smplr.loadInstrument(jsonA);

    // Defer B's load so we can observe the in-flight state.
    let resolveB: (b: AudioBuffer) => void = () => {};
    mockLoadBuffer.mockImplementation((_ctx: unknown, url: string) => {
      if (url.includes("/B.")) {
        return new Promise<AudioBuffer>((resolve) => {
          resolveB = resolve;
        });
      }
      return Promise.resolve(makeBuffer());
    });
    const loadPromise = smplr.loadInstrument(jsonB);

    // Before B resolves: matcher still serves A's region with A's buffer.
    smplr.start({ note: 60 });
    expect(ctx._sources).toHaveLength(1);
    expect(ctx._sources[0].buffer).toBe(bufferA);

    resolveB(bufferB);
    await loadPromise;

    // After B resolves: new voice uses B's buffer.
    smplr.start({ note: 60 });
    expect(ctx._sources).toHaveLength(2);
    expect(ctx._sources[1].buffer).toBe(bufferB);
  });

  it("loadInstrument clears reversed-buffer cache on swap", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext);

    const originalA = {
      numberOfChannels: 1,
      length: 4,
      sampleRate: 44100,
      getChannelData: jest.fn(() => new Float32Array([1, 2, 3, 4])),
    } as unknown as AudioBuffer;
    const originalB = {
      numberOfChannels: 1,
      length: 4,
      sampleRate: 44100,
      getChannelData: jest.fn(() => new Float32Array([5, 6, 7, 8])),
    } as unknown as AudioBuffer;

    const ctxWithCreate = ctx as unknown as {
      createBuffer: jest.Mock;
    };
    ctxWithCreate.createBuffer = jest.fn(
      (channels: number, length: number, sampleRate: number) => {
        const data: Float32Array[] = [];
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          copyToChannel: (arr: Float32Array, ch: number) => {
            data[ch] = arr;
          },
          getChannelData: (ch: number) => data[ch],
        } as unknown as AudioBuffer;
      },
    );

    const jsonReverse: SmplrPreset = {
      samples: { baseUrl: "https://example.com", formats: ["ogg"] },
      groups: [{ regions: [{ sample: "kick", key: 60 }] }],
    };

    // Pre-load buffers directly to bypass the SampleLoader's URL cache —
    // we want to simulate the same sample name resolving to different content.
    await smplr.loadInstrument(jsonReverse, new Map([["kick", originalA]]));

    smplr.start({ note: 60, reverse: true });
    expect(ctxWithCreate.createBuffer).toHaveBeenCalledTimes(1);

    await smplr.loadInstrument(jsonReverse, new Map([["kick", originalB]]));

    // Cache cleared → next reverse playback regenerates against new content.
    smplr.start({ note: 60, reverse: true });
    expect(ctxWithCreate.createBuffer).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// notesToLoad
// ---------------------------------------------------------------------------

describe("notesToLoad", () => {
  /** Regions keyed to C4 (60), E4 (64) and G4 (67). */
  function makeChordJson(): SmplrPreset {
    return makeJson({
      groups: [
        {
          regions: [
            { sample: "C4", key: 60 },
            { sample: "E4", key: 64 },
            { sample: "G4", key: 67 },
          ],
        },
      ],
    });
  }

  function fetchedSamples(): string[] {
    return (mockLoadBuffer.mock.calls as [unknown, string][]).map(
      ([, url]) => url.split("/").pop()!,
    );
  }

  it("only fetches the samples for the requested notes", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, {
      notesToLoad: { notes: ["C4", 67] },
    });
    await smplr.loadInstrument(makeChordJson());

    expect(fetchedSamples()).toEqual(["C4.ogg", "G4.ogg"]);
    expect(smplr.loadProgress).toEqual({ loaded: 2, total: 2 });
  });

  it("also filters a preset given at construction", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(
      ctx as unknown as AudioContext,
      makeChordJson(),
      { notesToLoad: { notes: [64] } },
    );
    await smplr.ready;

    expect(fetchedSamples()).toEqual(["E4.ogg"]);
  });

  it("does not play notes that weren't loaded by default", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, {
      notesToLoad: { notes: [60] },
    });
    await smplr.loadInstrument(makeChordJson());

    smplr.start({ note: 64 });
    expect(ctx._sources).toHaveLength(0);
    smplr.start({ note: 60 });
    expect(ctx._sources).toHaveLength(1);
  });

  it("plays the nearest loaded note, pitch-shifted, with fallback nearest", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, {
      notesToLoad: { notes: [60, 67], fallback: "nearest" },
    });
    await smplr.loadInstrument(makeChordJson());

    smplr.start({ note: 62 }); // nearest: C4 (60), +2 semitones
    smplr.start({ note: 65 }); // nearest: G4 (67), -2 semitones
    expect(ctx._sources.map((s) => s.detune.value)).toEqual([200, -200]);
  });

  it("shifts regions without a root pitch when falling back", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, {
      notesToLoad: { notes: [60], fallback: "nearest" },
    });
    await smplr.loadInstrument(
      makeJson({
        groups: [{ regions: [{ sample: "C4", keyRange: [60, 60] }] }],
      }),
    );

    smplr.start({ note: 63, detune: 10 });
    expect(ctx._sources[0].detune.value).toBe(310);
  });

  it("loadInstrument options override the instance notesToLoad", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, {
      notesToLoad: { notes: [60] },
    });
    await smplr.loadInstrument(makeChordJson(), {
      notesToLoad: { notes: [64], fallback: "nearest" },
    });

    expect(fetchedSamples()).toEqual(["E4.ogg"]);
    smplr.start({ note: 60 });
    expect(ctx._sources[0].detune.value).toBe(-400);
  });

  it("loadInstrument options accept pre-decoded buffers", async () => {
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext);
    await smplr.loadInstrument(makeJson(), {
      buffers: new Map([["C4", makeBuffer()]]),
    });

    expect(mockLoadBuffer).not.toHaveBeenCalled();
    smplr.start({ note: 60 });
    expect(ctx._sources).toHaveLength(1);
  });

  it("warns once per load about entries that match nothing", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = makeContext();
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, {
      notesToLoad: { notes: ["C4", "kik", "C#44"] },
    });
    await smplr.loadInstrument(makeChordJson());

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('"kik", "C#44"');
    expect(fetchedSamples()).toEqual(["C4.ogg"]);
    warn.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// maxVoices
// ---------------------------------------------------------------------------

describe("maxVoices", () => {
  it("is passed from the options to the voice cap", async () => {
    const ctx = makeContext(0) as any;
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson(), {
      maxVoices: 1,
    });
    await smplr.ready;

    smplr.start({ note: "C4" });
    ctx.currentTime = 1;
    smplr.start({ note: "C4" });

    // the first voice is faded out (10 ms) when the second one starts
    expect(ctx._sources[0].stop).toHaveBeenLastCalledWith(1.01);
    expect(ctx._sources[1].stop).not.toHaveBeenCalled();
  });

  it("doesn't limit voices when it isn't set", async () => {
    const ctx = makeContext(0) as any;
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start({ note: "C4" });
    ctx.currentTime = 1;
    smplr.start({ note: "C4" });

    expect(ctx._sources[0].stop).not.toHaveBeenCalled();
  });

  it("counts notes started with a duration while they are still audible", async () => {
    const ctx = makeContext(0) as any;
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson(), {
      maxVoices: 1,
    });
    await smplr.ready;

    smplr.start({ note: "C4", duration: 10 }); // sounds until 10 (+ release)
    ctx.currentTime = 1;
    smplr.start({ note: "C4" });

    expect(ctx._sources[0].stop).toHaveBeenLastCalledWith(1.01);
  });

  it("doesn't count a duration note that has already ended", async () => {
    const ctx = makeContext(0) as any;
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson(), {
      maxVoices: 1,
    });
    await smplr.ready;

    smplr.start({ note: "C4", duration: 0.5 }); // silent after 0.8 (default release 0.3)
    ctx.currentTime = 2;
    smplr.start({ note: "C4" });

    expect(ctx._sources[0].stop).toHaveBeenCalledTimes(1); // only the duration stop
    expect(ctx._sources[0].stop).toHaveBeenCalledWith(0.8);
  });

  it("schedules the duration stop before the voice is added, so the cap knows when it ends", async () => {
    const endTimes: number[] = [];
    const add = jest
      .spyOn(VoiceManager.prototype, "add")
      .mockImplementation(function (voice) {
        endTimes.push(voice.endTime);
      });
    const ctx = makeContext(0) as any;
    const smplr = new SmplrImpl(ctx as unknown as AudioContext, makeJson());
    await smplr.ready;

    smplr.start({ note: "C4", duration: 1 });

    expect(endTimes).toEqual([1.3]); // 1s + the default 0.3s release, not Infinity
    add.mockRestore();
  });
});
