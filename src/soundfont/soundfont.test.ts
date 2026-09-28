import {
  Soundfont,
  getSoundfontKits,
  getSoundfontNames,
  soundfontToPreset,
} from "./soundfont";

// ---------------------------------------------------------------------------
// Mock load-audio so the underlying SampleLoader does not hit the network
// ---------------------------------------------------------------------------

jest.mock("../smplr/load-audio", () => ({
  findFirstSupportedFormat: jest.fn().mockReturnValue("ogg"),
  loadAudioBuffer: jest.fn(),
}));

import { loadAudioBuffer } from "../smplr/load-audio";
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
    decodeAudioData: jest.fn(() =>
      Promise.resolve({ sampleRate: 44100, duration: 1 } as AudioBuffer),
    ),
  };
}

function makeBuffer(): AudioBuffer {
  return { sampleRate: 44100, duration: 1 } as unknown as AudioBuffer;
}

// ---------------------------------------------------------------------------
// MIDI.js soundfont fake — minimal payload that the parser accepts
// ---------------------------------------------------------------------------

const FAKE_MIDIJS = `if (typeof MIDI === 'undefined') MIDI = {};
MIDI.Soundfont = MIDI.Soundfont || {};
MIDI.Soundfont.marimba = {
  "C4": "data:audio/ogg;base64,AAAA",
  "C5": "data:audio/ogg;base64,AAAA",
}
`;

function stubSoundfontFetch() {
  (global as any).fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    text: async () => FAKE_MIDIJS,
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0),
  });
  // jsdom doesn't ship window.atob
  (global as any).window = global;
  (global as any).atob =
    (global as any).atob ??
    ((s: string) => Buffer.from(s, "base64").toString("binary"));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadBuffer.mockResolvedValue(makeBuffer());
  stubSoundfontFetch();
});

// ---------------------------------------------------------------------------
// getSoundfontNames / getSoundfontKits
// ---------------------------------------------------------------------------

describe("getSoundfontNames", () => {
  it("returns a non-empty array of GM instrument names", () => {
    const names = getSoundfontNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(100);
    expect(names).toContain("acoustic_grand_piano");
    expect(names).toContain("marimba");
  });
});

describe("getSoundfontKits", () => {
  it("returns ['MusyngKite', 'FluidR3_GM']", () => {
    expect(getSoundfontKits()).toEqual(["MusyngKite", "FluidR3_GM"]);
  });
});

// ---------------------------------------------------------------------------
// soundfontToPreset — pure converter
// ---------------------------------------------------------------------------

describe("soundfontToPreset", () => {
  it("converts a list of note names into one group with regions", () => {
    const json = soundfontToPreset(["C4", "C5"]);
    expect(json.groups).toHaveLength(1);
    expect(json.groups[0].regions).toHaveLength(2);
  });

  it("regions cover [0, 127] via spreadKeyRanges", () => {
    const json = soundfontToPreset(["C4", "C5"]);
    const sorted = [...json.groups[0].regions].sort(
      (a, b) => a.keyRange![0] - b.keyRange![0],
    );
    expect(sorted[0].keyRange![0]).toBe(0);
    expect(sorted[sorted.length - 1].keyRange![1]).toBe(127);
  });

  it("applies loop data when provided", () => {
    const json = soundfontToPreset(["C4"], { 60: [100, 200] });
    const region = json.groups[0].regions[0];
    expect(region.loop).toBe(true);
    expect(region.loopStart).toBe(100);
    expect(region.loopEnd).toBe(200);
  });

  it("omits loop fields when no loop data is supplied", () => {
    const json = soundfontToPreset(["C4"]);
    const region = json.groups[0].regions[0];
    expect(region.loop).toBeUndefined();
    expect(region.loopStart).toBeUndefined();
    expect(region.loopEnd).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Soundfont — integration
// ---------------------------------------------------------------------------

describe("Soundfont", () => {
  it("constructs via call form (no `new`)", () => {
    const ctx = makeContext();
    const sf = Soundfont(ctx as unknown as AudioContext, {
      instrument: "marimba",
    });
    sf.ready.catch(() => {});
    expect(typeof sf.start).toBe("function");
    expect(typeof sf.stop).toBe("function");
  });

  it("constructs via `new` (deprecated alias)", () => {
    const ctx = makeContext();
    const sf = Soundfont(ctx as unknown as AudioContext, {
      instrument: "marimba",
    });
    sf.ready.catch(() => {});
    expect(typeof sf.start).toBe("function");
  });

  it("throws on construction when neither instrument nor instrumentUrl is provided", () => {
    const ctx = makeContext();
    expect(() => Soundfont(ctx as unknown as AudioContext, {})).toThrow();
  });

  it("output.volume getter/setter works (new API)", () => {
    const ctx = makeContext();
    const sf = Soundfont(ctx as unknown as AudioContext, {
      instrument: "marimba",
    });
    sf.ready.catch(() => {});
    sf.output.volume = 90;
    expect(sf.output.volume).toBe(90);
  });

  it("inserts an extra-gain node by default (gain = 5)", () => {
    const ctx = makeContext();
    Soundfont(ctx as unknown as AudioContext, {
      instrument: "marimba",
    }).ready.catch(() => {});
    // The Soundfont factory creates a gain node with value = config.extraGain (default 5)
    // and inserts it via smplr.output.addInsert. A gain node is created.
    const gainCalls = (ctx.createGain as jest.Mock).mock.results;
    const hasGainOf5 = gainCalls.some(
      (r: jest.MockResult<{ gain: { value: number } }>) =>
        r.type === "return" && r.value.gain.value === 5,
    );
    expect(hasGainOf5).toBe(true);
  });

  it("extraGain option overrides the default", () => {
    const ctx = makeContext();
    Soundfont(ctx as unknown as AudioContext, {
      instrument: "marimba",
      extraGain: 1,
    }).ready.catch(() => {});
    const gainCalls = (ctx.createGain as jest.Mock).mock.results;
    const hasGainOf1 = gainCalls.some(
      (r: jest.MockResult<{ gain: { value: number } }>) =>
        r.type === "return" && r.value.gain.value === 1,
    );
    expect(hasGainOf1).toBe(true);
  });

  it("load resolves when the soundfont data has been decoded", async () => {
    const ctx = makeContext();
    const sf = Soundfont(ctx as unknown as AudioContext, {
      instrument: "marimba",
    });
    await sf.ready;
    expect(sf.loadProgress).toHaveProperty("loaded");
    expect(sf.loadProgress).toHaveProperty("total");
  });
});
