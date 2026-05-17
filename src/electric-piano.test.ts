import { ElectricPiano, getElectricPianoNames } from "./electric-piano";

// ---------------------------------------------------------------------------
// Mock load-audio so the underlying SampleLoader does not hit the network
// ---------------------------------------------------------------------------

jest.mock("./smplr/load-audio", () => ({
  findFirstSupportedFormat: jest.fn().mockReturnValue("ogg"),
  loadAudioBuffer: jest.fn(),
}));

import { loadAudioBuffer } from "./smplr/load-audio";
const mockLoadBuffer = loadAudioBuffer as jest.Mock;

// ---------------------------------------------------------------------------
// Fake AudioContext
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
    createStereoPanner: jest.fn(() => ({
      pan: { value: 0 },
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
    createOscillator: jest.fn(() => ({
      type: "sine",
      frequency: { value: 0 },
      connect: jest.fn(),
      disconnect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    })),
    createChannelSplitter: jest.fn(() => ({
      channelCountMode: "explicit",
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
    createChannelMerger: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
  };
}

function makeBuffer(): AudioBuffer {
  return { sampleRate: 44100, duration: 1 } as unknown as AudioBuffer;
}

// Minimal SFZ payload — one region keyed to MIDI 60 (C4)
const FAKE_SFZ = `<region> sample=samples/C4.wav lokey=0 hikey=127 pitch_keycenter=60`;

function stubSfzFetch() {
  (global as any).fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    text: async () => FAKE_SFZ,
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadBuffer.mockResolvedValue(makeBuffer());
  stubSfzFetch();
});

// ---------------------------------------------------------------------------
// getElectricPianoNames
// ---------------------------------------------------------------------------

describe("getElectricPianoNames", () => {
  it("returns CP80, PianetT, WurlitzerEP200, TX81Z", () => {
    expect(getElectricPianoNames()).toEqual(
      expect.arrayContaining(["CP80", "PianetT", "WurlitzerEP200", "TX81Z"]),
    );
  });
});

// ---------------------------------------------------------------------------
// ElectricPiano
// ---------------------------------------------------------------------------

describe("ElectricPiano", () => {
  it("constructs via call form (no `new`)", () => {
    const ctx = makeContext();
    const ep = ElectricPiano(ctx as unknown as AudioContext, {
      instrument: "PianetT",
    });
    ep.load.catch(() => {});
    expect(typeof ep.start).toBe("function");
    expect(typeof ep.stop).toBe("function");
  });

  it("constructs via `new` (deprecated alias)", () => {
    const ctx = makeContext();
    const ep = new ElectricPiano(ctx as unknown as AudioContext, {
      instrument: "PianetT",
    });
    ep.load.catch(() => {});
    expect(typeof ep.start).toBe("function");
  });

  it("throws on an invalid instrument name", () => {
    const ctx = makeContext();
    expect(() =>
      ElectricPiano(ctx as unknown as AudioContext, {
        instrument: "bogus",
      }),
    ).toThrow(/Unknown electric piano/);
  });

  it("tremolo.level is callable before load resolves (CD-2 sync extras)", () => {
    const ctx = makeContext();
    const ep = ElectricPiano(ctx as unknown as AudioContext, {
      instrument: "PianetT",
    });
    ep.load.catch(() => {});

    expect(typeof ep.tremolo.level).toBe("function");
    expect(() => ep.tremolo.level(30)).not.toThrow();
  });

  it("tremolo.level accepts a range of values without throwing", () => {
    const ctx = makeContext();
    const ep = ElectricPiano(ctx as unknown as AudioContext, {
      instrument: "WurlitzerEP200",
    });
    ep.load.catch(() => {});

    expect(() => ep.tremolo.level(0)).not.toThrow();
    expect(() => ep.tremolo.level(64)).not.toThrow();
    expect(() => ep.tremolo.level(127)).not.toThrow();
  });

  it("inserts the tremolo node into the audio graph", () => {
    const ctx = makeContext();
    ElectricPiano(ctx as unknown as AudioContext, {
      instrument: "PianetT",
    }).load.catch(() => {});

    // The tremolo node is built from createOscillator + createGain — assert
    // at least one oscillator was created during construction.
    expect(ctx.createOscillator).toHaveBeenCalled();
  });

  it("load resolves after the SFZ file is fetched and parsed", async () => {
    const ctx = makeContext();
    const ep = ElectricPiano(ctx as unknown as AudioContext, {
      instrument: "PianetT",
    });
    await ep.load;

    expect((global as any).fetch).toHaveBeenCalled();
    expect(ep.loadProgress).toHaveProperty("loaded");
    expect(ep.loadProgress).toHaveProperty("total");
  });

  it("output.volume getter/setter works (new API)", () => {
    const ctx = makeContext();
    const ep = ElectricPiano(ctx as unknown as AudioContext, {
      instrument: "PianetT",
    });
    ep.load.catch(() => {});
    ep.output.volume = 50;
    expect(ep.output.volume).toBe(50);
  });
});
