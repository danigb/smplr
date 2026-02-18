import { midiVelToGain, dbToGain } from "../player/volume";
import { VoiceParams } from "./types";
import { Voice } from "./voice";

// ---------------------------------------------------------------------------
// Minimal self-contained mock — only what Voice needs
// ---------------------------------------------------------------------------

function makeGain() {
  return {
    gain: {
      value: 1,
      cancelScheduledValues: jest.fn(),
      setValueAtTime: jest.fn(),
      linearRampToValueAtTime: jest.fn(),
    },
    connected: [] as unknown[],
    connect(dest: unknown) {
      this.connected.push(dest);
    },
    disconnect: jest.fn(),
  };
}

function makeFilter() {
  return {
    type: "" as BiquadFilterType,
    frequency: { value: 0 },
    connected: [] as unknown[],
    connect(dest: unknown) {
      this.connected.push(dest);
    },
    disconnect: jest.fn(),
  };
}

type SourceMock = ReturnType<typeof makeSource>;

function makeSource({ withDetune = true } = {}) {
  return {
    buffer: null as AudioBuffer | null,
    ...(withDetune ? { detune: { value: 0 } } : {}),
    playbackRate: { value: 1 },
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    onended: null as (() => void) | null,
    startedAt: undefined as number | undefined,
    startedOffset: undefined as number | undefined,
    stoppedAt: undefined as number | undefined,
    connected: [] as unknown[],
    connect(dest: unknown) {
      this.connected.push(dest);
    },
    disconnect: jest.fn(),
    start(when?: number, offset?: number) {
      this.startedAt = when;
      this.startedOffset = offset;
    },
    stop(when?: number) {
      this.stoppedAt = when;
    },
    /** Simulate the Web Audio engine firing onended */
    triggerEnded() {
      this.onended?.();
    },
  };
}

function makeContext({ safari = false, currentTime = 0 } = {}) {
  const sources: SourceMock[] = [];
  const gains: ReturnType<typeof makeGain>[] = [];
  const filters: ReturnType<typeof makeFilter>[] = [];

  const ctx = {
    currentTime,
    destination: {} as unknown as AudioNode,
    createBufferSource() {
      const s = makeSource({ withDetune: !safari });
      sources.push(s);
      return s as unknown as AudioBufferSourceNode;
    },
    createGain() {
      const g = makeGain();
      gains.push(g);
      return g as unknown as GainNode;
    },
    createBiquadFilter() {
      const f = makeFilter();
      filters.push(f);
      return f as unknown as BiquadFilterNode;
    },
  };

  return { ctx: ctx as unknown as BaseAudioContext, sources, gains, filters };
}

function makeBuffer({
  sampleRate = 44100,
  duration = 2.0,
}: { sampleRate?: number; duration?: number } = {}): AudioBuffer {
  return {
    sampleRate,
    duration,
    numberOfChannels: 1,
    length: Math.floor(sampleRate * duration),
    getChannelData: jest.fn(),
    copyFromChannel: jest.fn(),
    copyToChannel: jest.fn(),
  } as unknown as AudioBuffer;
}

function makeDestination() {
  const dest = {
    connected: [] as unknown[],
    connect(d: unknown) {
      dest.connected.push(d);
    },
  };
  return dest as unknown as AudioNode;
}

const BASE_PARAMS: VoiceParams = {
  detune: 0,
  velocity: 100,
  volume: 0,
  ampRelease: 0.3,
  ampAttack: 0,
  lpfCutoffHz: 20000,
  offset: 0,
  loop: false,
  loopStart: 0,
  loopEnd: 0,
};

function makeVoice(
  overrides: Partial<VoiceParams> = {},
  {
    safari = false,
    currentTime = 0,
    startTime,
    stopId = "C4",
    group,
  }: {
    safari?: boolean;
    currentTime?: number;
    startTime?: number;
    stopId?: string | number;
    group?: number;
  } = {}
) {
  const { ctx, sources, gains, filters } = makeContext({ safari, currentTime });
  const buffer = makeBuffer();
  const destination = makeDestination();
  const params = { ...BASE_PARAMS, ...overrides };
  const voice = new Voice(ctx, buffer, params, destination, stopId, group, startTime);
  return { voice, ctx, sources, gains, filters, buffer, destination };
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe("construction", () => {
  it("assigns buffer to source", () => {
    const { sources, buffer } = makeVoice();
    expect(sources[0].buffer).toBe(buffer);
  });

  it("sets stopId and group", () => {
    const { voice } = makeVoice({}, { stopId: "A4", group: 2 });
    expect(voice.stopId).toBe("A4");
    expect(voice.group).toBe(2);
  });

  it("group is undefined when not provided", () => {
    const { voice } = makeVoice();
    expect(voice.group).toBeUndefined();
  });

  it("calls source.start with startTime", () => {
    const { sources } = makeVoice({}, { startTime: 1.5 });
    expect(sources[0].startedAt).toBe(1.5);
  });

  it("uses context.currentTime when startTime is omitted", () => {
    const { sources } = makeVoice({}, { currentTime: 0.8 });
    expect(sources[0].startedAt).toBe(0.8);
  });

  it("isActive is true after construction", () => {
    const { voice } = makeVoice();
    expect(voice.isActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Audio graph wiring
// ---------------------------------------------------------------------------

describe("audio graph", () => {
  it("source connects directly to gain when lpfCutoffHz = 20000", () => {
    const { sources, gains, filters } = makeVoice({ lpfCutoffHz: 20000 });
    expect(filters).toHaveLength(0);
    expect(sources[0].connected[0]).toBe(gains[0]); // source → gain (velocity)
  });

  it("inserts LPF when lpfCutoffHz < 20000", () => {
    const { sources, gains, filters } = makeVoice({ lpfCutoffHz: 1000 });
    expect(filters).toHaveLength(1);
    expect(sources[0].connected[0]).toBe(filters[0]); // source → lpf
    expect(filters[0].connected[0]).toBe(gains[0]); // lpf → gain
  });

  it("sets LPF type and frequency", () => {
    const { filters } = makeVoice({ lpfCutoffHz: 1000 });
    expect(filters[0].type).toBe("lowpass");
    expect(filters[0].frequency.value).toBe(1000);
  });

  it("velocity gain (index 0) × volume dB", () => {
    const { gains } = makeVoice({ velocity: 80, volume: -6 });
    const expected = midiVelToGain(80) * dbToGain(-6);
    expect(gains[0].gain.value).toBeCloseTo(expected);
  });

  it("envelope gain (index 1) starts at 1.0", () => {
    const { gains } = makeVoice();
    const envelope = gains[1]; // second gain is the envelope
    expect(envelope.gain.value).toBe(1.0);
  });

  it("gain connects to envelope, envelope connects to destination", () => {
    const { gains, destination } = makeVoice();
    const [velocityGain, envelope] = gains;
    expect(velocityGain.connected[0]).toBe(envelope);
    expect(envelope.connected[0]).toBe(destination);
  });
});

// ---------------------------------------------------------------------------
// Detune
// ---------------------------------------------------------------------------

describe("detune", () => {
  it("sets source.detune when available", () => {
    const { sources } = makeVoice({ detune: 200 });
    expect((sources[0] as any).detune.value).toBe(200);
  });

  it("Safari path: uses playbackRate when source.detune is absent", () => {
    const { sources } = makeVoice({ detune: 200 }, { safari: true });
    // No detune property on source
    expect((sources[0] as any).detune).toBeUndefined();
    // playbackRate = 2^(200/1200)
    expect(sources[0].playbackRate.value).toBeCloseTo(Math.pow(2, 200 / 1200));
  });

  it("0 cents → playbackRate = 1 on Safari", () => {
    const { sources } = makeVoice({ detune: 0 }, { safari: true });
    expect(sources[0].playbackRate.value).toBeCloseTo(1);
  });
});

// ---------------------------------------------------------------------------
// Looping
// ---------------------------------------------------------------------------

describe("looping", () => {
  it("sets loop properties when loop = true", () => {
    const { sources } = makeVoice({ loop: true, loopStart: 0.5, loopEnd: 1.5 });
    expect(sources[0].loop).toBe(true);
    expect(sources[0].loopStart).toBe(0.5);
    expect(sources[0].loopEnd).toBe(1.5);
  });

  it("falls back to buffer.duration when loopEnd = 0", () => {
    const { sources, buffer } = makeVoice({ loop: true, loopEnd: 0 });
    expect(sources[0].loopEnd).toBe(buffer.duration);
  });

  it("does not set loop properties when loop = false", () => {
    const { sources } = makeVoice({ loop: false });
    expect(sources[0].loop).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Offset
// ---------------------------------------------------------------------------

describe("offset", () => {
  it("passes no offset to source.start when offset = 0", () => {
    const { sources } = makeVoice({ offset: 0 });
    expect(sources[0].startedOffset).toBe(0);
  });

  it("converts sample-frame offset to seconds", () => {
    // 44100 frames at 44100 Hz = 1 second
    const { sources } = makeVoice({ offset: 44100 });
    expect(sources[0].startedOffset).toBeCloseTo(1.0);
  });
});

// ---------------------------------------------------------------------------
// stop()
// ---------------------------------------------------------------------------

describe("stop()", () => {
  it("with time after startAt: ramps envelope and stops source at t + ampRelease", () => {
    const { voice, sources, gains } = makeVoice({ ampRelease: 0.5 }, { currentTime: 1 });
    const envelope = gains[1];

    voice.stop(2); // time=2, startAt=1

    expect(envelope.gain.cancelScheduledValues).toHaveBeenCalledWith(2);
    expect(envelope.gain.setValueAtTime).toHaveBeenCalledWith(1.0, 2);
    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 2.5); // 2 + 0.5
    expect(sources[0].stoppedAt).toBe(2.5);
  });

  it("with no time argument: uses context.currentTime", () => {
    const { voice, sources, gains } = makeVoice({ ampRelease: 0.3 }, { currentTime: 1 });
    const envelope = gains[1];

    voice.stop(); // no time → uses currentTime=1, startAt=1 → t <= startAt

    // currentTime (1) <= startAt (1): immediate stop path
    expect(sources[0].stoppedAt).toBe(1);
    expect(envelope.gain.cancelScheduledValues).not.toHaveBeenCalled();
  });

  it("with time at or before startAt: stops source immediately without envelope", () => {
    const { voice, sources, gains } = makeVoice({}, { startTime: 2 });
    const envelope = gains[1];

    voice.stop(1); // time=1 ≤ startAt=2

    expect(sources[0].stoppedAt).toBe(1);
    expect(envelope.gain.cancelScheduledValues).not.toHaveBeenCalled();
  });

  it("is idempotent — second call does nothing", () => {
    const { voice, sources } = makeVoice({ ampRelease: 0.5 }, { currentTime: 1 });

    voice.stop(2);
    voice.stop(2);

    // source.stop called exactly once
    expect(sources[0].stoppedAt).toBe(2.5);
    // Only one stop call — second stop() returned early
    // Verify by checking the source was only stopped once (stoppedAt set once)
    const stopCallCount = jest.fn();
    sources[0].stop = stopCallCount;
    voice.stop(2); // third call — should do nothing
    expect(stopCallCount).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// isActive and onEnded
// ---------------------------------------------------------------------------

describe("isActive / onEnded", () => {
  it("isActive transitions to false when source fires onended", () => {
    const { voice, sources } = makeVoice();
    expect(voice.isActive).toBe(true);
    sources[0].triggerEnded();
    expect(voice.isActive).toBe(false);
  });

  it("onEnded callback is called when source fires onended", () => {
    const { voice, sources } = makeVoice();
    const cb = jest.fn();
    voice.onEnded(cb);
    sources[0].triggerEnded();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("multiple onEnded callbacks are all called", () => {
    const { voice, sources } = makeVoice();
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    voice.onEnded(cb1);
    voice.onEnded(cb2);
    sources[0].triggerEnded();
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("onEnded callback is called immediately when voice already stopped", () => {
    const { voice, sources } = makeVoice();
    sources[0].triggerEnded();
    const cb = jest.fn();
    voice.onEnded(cb); // registered after stop
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("onended disconnects all audio nodes", () => {
    const { sources, gains, filters } = makeVoice({ lpfCutoffHz: 1000 });
    sources[0].triggerEnded();
    expect(gains[0].disconnect).toHaveBeenCalled(); // velocity gain
    expect(gains[1].disconnect).toHaveBeenCalled(); // envelope
    expect(filters[0].disconnect).toHaveBeenCalled(); // lpf
  });
});
