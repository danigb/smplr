import { midiVelToGain, dbToGain } from "./volume";
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

/** AudioParam mock recording automation calls. */
function makeParam(value = 0) {
  return {
    value,
    cancelScheduledValues: jest.fn(),
    setValueAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
  };
}

function makeFilter() {
  return {
    type: "" as BiquadFilterType,
    frequency: makeParam(),
    Q: { value: 0 },
    connected: [] as unknown[],
    connect(dest: unknown) {
      this.connected.push(dest);
    },
    disconnect: jest.fn(),
  };
}

function makePanner() {
  return {
    pan: { value: 0 },
    connected: [] as unknown[],
    connect(dest: unknown) {
      this.connected.push(dest);
    },
    disconnect: jest.fn(),
  };
}

/** A connectable AudioParam mock, for source.detune (LFOs sum their output onto it). */
function makeDetune() {
  return {
    ...makeParam(),
    connected: [] as unknown[],
    connect(dest: unknown) {
      this.connected.push(dest);
    },
  };
}

function makeOscillator() {
  return {
    type: "" as OscillatorType,
    frequency: { value: 0 },
    connected: [] as unknown[],
    connect(dest: unknown) {
      this.connected.push(dest);
    },
    disconnect: jest.fn(),
    startedAt: undefined as number | undefined,
    stoppedAt: undefined as number | undefined,
    start(when?: number) {
      this.startedAt = when;
    },
    stop(when?: number) {
      this.stoppedAt = when;
    },
  };
}

type SourceMock = ReturnType<typeof makeSource>;

function makeSource({ withDetune = true } = {}) {
  return {
    buffer: null as AudioBuffer | null,
    ...(withDetune ? { detune: makeDetune() } : {}),
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
  const panners: ReturnType<typeof makePanner>[] = [];
  const oscillators: ReturnType<typeof makeOscillator>[] = [];

  const ctx = {
    currentTime,
    sampleRate: 44100,
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
    createStereoPanner() {
      const p = makePanner();
      panners.push(p);
      return p as unknown as StereoPannerNode;
    },
    createOscillator() {
      const o = makeOscillator();
      oscillators.push(o);
      return o as unknown as OscillatorNode;
    },
  };

  return {
    ctx: ctx as unknown as BaseAudioContext,
    sources,
    gains,
    filters,
    panners,
    oscillators,
  };
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
  pan: 0,
  ampDelay: 0,
  ampAttack: 0,
  ampHold: 0,
  ampDecay: 0,
  ampSustain: 1,
  ampRelease: 0.3,
  lpfCutoffHz: 20000,
  lpfQ: 1,
  modLfoToPitch: 0,
  modLfoToFilterFc: 0,
  modLfoToVolume: 0,
  modLfoRateHz: 8.176,
  modLfoDelay: 0,
  vibLfoToPitch: 0,
  vibLfoRateHz: 8.176,
  vibLfoDelay: 0,
  modEnvToPitch: 0,
  modEnvToFilterFc: 0,
  modEnvDelay: 0,
  modEnvAttack: 0,
  modEnvHold: 0,
  modEnvDecay: 0,
  modEnvSustain: 1,
  modEnvRelease: 0,
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
  } = {},
) {
  const { ctx, sources, gains, filters, panners, oscillators } = makeContext({
    safari,
    currentTime,
  });
  const buffer = makeBuffer();
  const destination = makeDestination();
  const params = { ...BASE_PARAMS, ...overrides };
  const voice = new Voice(
    ctx,
    buffer,
    params,
    destination,
    stopId,
    group,
    startTime,
  );
  return {
    voice,
    ctx,
    sources,
    gains,
    filters,
    panners,
    oscillators,
    buffer,
    destination,
  };
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

  it("sets LPF Q (resonance) when the LPF is inserted", () => {
    const { filters } = makeVoice({ lpfCutoffHz: 1000, lpfQ: 15 });
    expect(filters[0].Q.value).toBe(15);
  });

  it("does not create a filter for lpfQ alone when lpfCutoffHz = 20000", () => {
    const { filters } = makeVoice({ lpfCutoffHz: 20000, lpfQ: 15 });
    expect(filters).toHaveLength(0);
  });

  it("velocity gain (index 0) × volume dB", () => {
    const { gains } = makeVoice({ velocity: 80, volume: -6 });
    const expected = midiVelToGain(80) * dbToGain(-6);
    expect(gains[0].gain.value).toBeCloseTo(expected);
  });

  it("envelope gain (index 1) starts at 1.0 when ampAttack = 0", () => {
    const { gains } = makeVoice();
    const envelope = gains[1]; // second gain is the envelope
    expect(envelope.gain.value).toBe(1.0);
    expect(envelope.gain.setValueAtTime).not.toHaveBeenCalled();
  });

  it("gain connects to envelope, envelope connects to destination", () => {
    const { gains, destination } = makeVoice();
    const [velocityGain, envelope] = gains;
    expect(velocityGain.connected[0]).toBe(envelope);
    expect(envelope.connected[0]).toBe(destination);
  });
});

// ---------------------------------------------------------------------------
// Pan
// ---------------------------------------------------------------------------

describe("pan", () => {
  it("does not create a panner when pan = 0 (center)", () => {
    const { gains, panners } = makeVoice({ pan: 0 });
    expect(panners).toHaveLength(0);
    // gain connects directly to envelope (gains[1])
    expect(gains[0].connected[0]).toBe(gains[1]);
  });

  it("creates a StereoPannerNode and sets its pan value when pan != 0", () => {
    const { panners } = makeVoice({ pan: -0.5 });
    expect(panners).toHaveLength(1);
    expect(panners[0].pan.value).toBe(-0.5);
  });

  it("wires gain → pan → envelope when pan != 0", () => {
    const { gains, panners } = makeVoice({ pan: 0.75 });
    const [velocityGain, envelope] = gains;
    expect(velocityGain.connected[0]).toBe(panners[0]);
    expect(panners[0].connected[0]).toBe(envelope);
  });

  it("disconnects the panner on source end", () => {
    const { sources, panners } = makeVoice({ pan: 1 });
    sources[0].triggerEnded();
    expect(panners[0].disconnect).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Attack
// ---------------------------------------------------------------------------

describe("attack", () => {
  it("schedules a 0 -> 1 ramp over ampAttack seconds when ampAttack > 0", () => {
    const { gains } = makeVoice({ ampAttack: 0.05 }, { currentTime: 1 });
    const envelope = gains[1];

    expect(envelope.gain.setValueAtTime).toHaveBeenCalledWith(0, 1);
    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1.0,
      1.05,
    );
  });

  it("schedules the ramp from startTime, not currentTime, when a future startTime is given", () => {
    const { gains } = makeVoice(
      { ampAttack: 0.1 },
      { currentTime: 0, startTime: 2 },
    );
    const envelope = gains[1];

    expect(envelope.gain.setValueAtTime).toHaveBeenCalledWith(0, 2);
    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1.0,
      2.1,
    );
  });

  it("does not schedule any envelope automation when ampAttack = 0", () => {
    const { gains } = makeVoice({ ampAttack: 0 });
    const envelope = gains[1];

    expect(envelope.gain.setValueAtTime).not.toHaveBeenCalled();
    expect(envelope.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
    expect(envelope.gain.value).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// Delay
// ---------------------------------------------------------------------------

describe("delay", () => {
  it("holds the envelope at 0 until ampDelay elapses, then attacks", () => {
    const { gains } = makeVoice(
      { ampDelay: 0.2, ampAttack: 0.1 },
      { currentTime: 1 },
    );
    const envelope = gains[1];

    expect(envelope.gain.setValueAtTime).toHaveBeenCalledWith(0, 1.2); // delayEnd
    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1.0,
      1.3,
    ); // attackEnd
  });
});

// ---------------------------------------------------------------------------
// Hold
// ---------------------------------------------------------------------------

describe("hold", () => {
  it("holds the envelope flat at 1 through ampHold before decay starts", () => {
    const { gains } = makeVoice(
      { ampAttack: 0.1, ampHold: 0.2, ampDecay: 0.1, ampSustain: 0.5 },
      { currentTime: 1 },
    );
    const envelope = gains[1];

    expect(envelope.gain.setValueAtTime).toHaveBeenCalledWith(1.0, 1.3); // holdEnd = attackEnd(1.1) + hold(0.2)
  });
});

// ---------------------------------------------------------------------------
// Decay / sustain
// ---------------------------------------------------------------------------

describe("decay/sustain", () => {
  it("ramps from 1 to ampSustain, over ampDecay scaled by how far it has to fall", () => {
    // ampDecay is the time for a *full* (100%) decay; reaching ampSustain=0.25 only takes 75% of it.
    const { gains } = makeVoice(
      { ampDecay: 1, ampSustain: 0.25 },
      { currentTime: 0 },
    );
    const envelope = gains[1];

    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.25,
      0.75,
    );
  });

  it("does not schedule envelope automation when ampDecay > 0 but ampSustain = 1 (nothing to decay to)", () => {
    const { gains } = makeVoice({ ampDecay: 1, ampSustain: 1 });
    const envelope = gains[1];

    expect(envelope.gain.setValueAtTime).not.toHaveBeenCalled();
    expect(envelope.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
    expect(envelope.gain.value).toBe(1.0);
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
// LFO pitch modulation
// ---------------------------------------------------------------------------

describe("LFO pitch modulation", () => {
  it("does not create an oscillator when both LFO depths are 0", () => {
    const { oscillators } = makeVoice({ modLfoToPitch: 0, vibLfoToPitch: 0 });
    expect(oscillators).toHaveLength(0);
  });

  it("creates a sine oscillator for the mod LFO when modLfoToPitch != 0, wired through a depth gain to source.detune", () => {
    const { sources, oscillators } = makeVoice({
      modLfoToPitch: 25,
      modLfoRateHz: 6,
    });
    expect(oscillators).toHaveLength(1);
    const [osc] = oscillators;
    expect(osc.type).toBe("sine");
    expect(osc.frequency.value).toBe(6);

    const depth = osc.connected[0] as ReturnType<typeof makeGain>;
    expect(depth.gain.value).toBe(25);
    expect(depth.connected[0]).toBe((sources[0] as any).detune);
  });

  it("starts the mod LFO at startAt + modLfoDelay", () => {
    const { oscillators } = makeVoice(
      { modLfoToPitch: 10, modLfoDelay: 0.3 },
      { currentTime: 1 },
    );
    expect(oscillators[0].startedAt).toBe(1.3);
  });

  it("creates independent oscillators for mod LFO and vib LFO when both are active", () => {
    const { oscillators } = makeVoice({
      modLfoToPitch: 10,
      modLfoRateHz: 4,
      vibLfoToPitch: 20,
      vibLfoRateHz: 6,
    });
    expect(oscillators).toHaveLength(2);
    expect(oscillators.map((o) => o.frequency.value).sort()).toEqual([4, 6]);
  });

  it("does not create an oscillator on the Safari playbackRate fallback (no detune AudioParam to sum onto)", () => {
    const { oscillators } = makeVoice({ modLfoToPitch: 10 }, { safari: true });
    expect(oscillators).toHaveLength(0);
  });

  it("stops both LFO oscillators at the same time the source stops", () => {
    const { voice, sources, oscillators } = makeVoice(
      { modLfoToPitch: 10, vibLfoToPitch: 10, ampRelease: 0.4 },
      { currentTime: 0 },
    );

    voice.stop(1);

    expect(sources[0].stoppedAt).toBe(1.4);
    expect(oscillators[0].stoppedAt).toBe(1.4);
    expect(oscillators[1].stoppedAt).toBe(1.4);
  });
});

// ---------------------------------------------------------------------------
// LFO filter/volume modulation
// ---------------------------------------------------------------------------

describe("LFO filter/volume modulation", () => {
  it("connects the mod LFO to lpf.frequency, depth linearized around the base cutoff", () => {
    const { filters, oscillators } = makeVoice({
      lpfCutoffHz: 1000,
      modLfoToFilterFc: 1200, // one octave of SF2 depth
    });
    expect(oscillators).toHaveLength(1);
    // dHz = baseHz * ln(2)/1200 * depthCents = 1000 * ln(2) for a 1200-cent depth
    const expectedDepthHz = 1000 * Math.LN2;
    const depth = oscillators[0].connected.find(
      (c) => (c as any).connected?.[0] === filters[0].frequency,
    ) as ReturnType<typeof makeGain>;
    expect(depth.gain.value).toBeCloseTo(expectedDepthHz);
  });

  it("creates the LPF for modLfoToFilterFc even at the default cutoff (lpfCutoffHz = 20000)", () => {
    const { oscillators, filters } = makeVoice({
      lpfCutoffHz: 20000,
      modLfoToFilterFc: 1200,
    });
    expect(filters).toHaveLength(1);
    expect(oscillators).toHaveLength(1);
  });

  it("clamps the filter LFO depth so the cutoff never goes below 0 Hz", () => {
    const { oscillators, filters } = makeVoice({
      lpfCutoffHz: 1000,
      modLfoToFilterFc: 12000, // 10 octaves: unclamped depth would be ~5.8x the cutoff
    });
    const depth = oscillators[0].connected.find(
      (c) => (c as any).connected?.[0] === filters[0].frequency,
    ) as ReturnType<typeof makeGain>;
    expect(depth.gain.value).toBe(1000);
  });

  it("clamps a negative filter LFO depth the same way", () => {
    const { oscillators, filters } = makeVoice({
      lpfCutoffHz: 1000,
      modLfoToFilterFc: -12000,
    });
    const depth = oscillators[0].connected.find(
      (c) => (c as any).connected?.[0] === filters[0].frequency,
    ) as ReturnType<typeof makeGain>;
    expect(depth.gain.value).toBe(-1000);
  });

  it("clamps the volume LFO depth: no phase inversion and no boost beyond 2x", () => {
    const { gains, oscillators } = makeVoice({
      velocity: 127,
      volume: 0,
      modLfoToVolume: 960, // 96 dB: unclamped depth would be ~11x the base gain
    });
    const depth = oscillators[0].connected.find(
      (c) => (c as any).connected?.[0] === gains[0].gain,
    ) as ReturnType<typeof makeGain>;
    expect(depth.gain.value).toBe(1); // base gain is 1
  });

  it("connects the mod LFO to gain.gain, depth linearized around the base velocity/volume gain", () => {
    // velocity=127, volume=0dB -> base linear gain = 1 (exact, see midiVelToGain)
    const { gains, oscillators } = makeVoice({
      velocity: 127,
      volume: 0,
      modLfoToVolume: 50, // 5dB (50 centibels) of SF2 depth
    });
    expect(oscillators).toHaveLength(1);
    const expectedDepthLinear = 1 * (Math.LN10 / 200) * 50;
    const velocityGain = gains[0];
    const depth = oscillators[0].connected.find(
      (c) => (c as any).connected?.[0] === velocityGain.gain,
    ) as ReturnType<typeof makeGain>;
    expect(depth.gain.value).toBeCloseTo(expectedDepthLinear);
  });

  it("shares a single oscillator across pitch, filter, and volume when all three are active", () => {
    const { oscillators } = makeVoice({
      lpfCutoffHz: 1000,
      modLfoToPitch: 10,
      modLfoToFilterFc: 200,
      modLfoToVolume: 20,
    });
    expect(oscillators).toHaveLength(1);
    expect(oscillators[0].connected).toHaveLength(3);
  });

  it("does not create anything when all mod LFO depths are 0", () => {
    const { oscillators } = makeVoice({
      lpfCutoffHz: 1000,
      modLfoToPitch: 0,
      modLfoToFilterFc: 0,
      modLfoToVolume: 0,
    });
    expect(oscillators).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Modulation envelope
// ---------------------------------------------------------------------------

describe("modulation envelope", () => {
  const detuneOf = (sources: unknown[]) => (sources[0] as any).detune;

  it("creates no extra audio nodes (it is scheduled as AudioParam automation)", () => {
    const { oscillators, gains } = makeVoice({
      lpfCutoffHz: 1000,
      modEnvToPitch: 30,
      modEnvToFilterFc: 500,
      modEnvAttack: 0.5,
    });
    expect(oscillators).toHaveLength(0);
    expect(gains).toHaveLength(2); // velocity gain + amplitude envelope only
  });

  it("does nothing when both mod envelope depths are 0", () => {
    const { sources } = makeVoice({ modEnvToPitch: 0, modEnvToFilterFc: 0 });
    expect(detuneOf(sources).setValueAtTime).not.toHaveBeenCalled();
  });

  it("creates the LPF for a downward modEnvToFilterFc sweep even at the default cutoff", () => {
    const { filters } = makeVoice({
      lpfCutoffHz: 20000,
      modEnvToFilterFc: -4800,
      modEnvAttack: 1,
    });
    expect(filters).toHaveLength(1);
    // the sweep starts at the cutoff * 2^(-4800/1200) = 20000 / 16 at full envelope
    expect(filters[0].frequency.setValueAtTime).toHaveBeenCalledWith(20000, 0);
    expect(
      filters[0].frequency.exponentialRampToValueAtTime,
    ).toHaveBeenCalledWith(1250, 1);
  });

  it("creates no LPF when neither the cutoff nor any filter modulation is set", () => {
    const { filters } = makeVoice({ lpfCutoffHz: 20000 });
    expect(filters).toHaveLength(0);
  });

  it("schedules pitch as linear-in-cents automation on source.detune, around the note's own detune", () => {
    const { sources } = makeVoice(
      { detune: 100, modEnvToPitch: 1200, modEnvAttack: 0.5, modEnvSustain: 1 },
      { currentTime: 2 },
    );
    const detune = detuneOf(sources);
    expect(detune.setValueAtTime).toHaveBeenCalledWith(100, 2); // env 0 -> base pitch
    expect(detune.linearRampToValueAtTime).toHaveBeenCalledWith(1300, 2.5); // env 1 -> base + depth
  });

  it("schedules the filter as exponential automation in Hz (exact: linear in cents)", () => {
    const { filters } = makeVoice(
      { lpfCutoffHz: 1000, modEnvToFilterFc: 1200, modEnvAttack: 0.5 },
      { currentTime: 1 },
    );
    const freq = filters[0].frequency;
    expect(freq.setValueAtTime).toHaveBeenCalledWith(1000, 1); // env 0 -> base cutoff
    expect(freq.exponentialRampToValueAtTime).toHaveBeenCalledWith(2000, 1.5); // +1200 cents = 1 octave
    expect(freq.linearRampToValueAtTime).not.toHaveBeenCalled();
  });

  it("clamps the filter target to Nyquist and keeps it positive", () => {
    const { filters } = makeVoice({
      lpfCutoffHz: 15000,
      modEnvToFilterFc: 4800,
      modEnvAttack: 0.1,
    });
    const targets =
      filters[0].frequency.exponentialRampToValueAtTime.mock.calls.map(
        (c) => c[0],
      );
    expect(Math.max(...targets)).toBeLessThanOrEqual(22050);
    expect(Math.min(...targets)).toBeGreaterThan(0);
  });

  it("holds the target flat at full depth (no automation) when the envelope has no shape", () => {
    const { sources } = makeVoice({ detune: 50, modEnvToPitch: 200 });
    const detune = detuneOf(sources);
    expect(detune.value).toBe(250);
    expect(detune.setValueAtTime).not.toHaveBeenCalled();
  });

  it("releases from the envelope's current value with its own release time, independent of the amplitude envelope's", () => {
    const { voice, sources } = makeVoice(
      {
        modEnvToPitch: 1000,
        modEnvAttack: 1, // stopped 0.5s in -> env = 0.5
        modEnvRelease: 2,
        ampRelease: 0.5,
      },
      { currentTime: 0 },
    );
    const detune = detuneOf(sources);

    voice.stop(0.5);

    expect(detune.cancelScheduledValues).toHaveBeenCalledWith(0.5);
    expect(detune.linearRampToValueAtTime).toHaveBeenCalledWith(500, 0.5); // 0 + 1000 * 0.5
    expect(detune.linearRampToValueAtTime).toHaveBeenCalledWith(0, 2.5); // back to base over modEnvRelease (0.5 + 2)
    expect(sources[0].stoppedAt).toBe(1); // amplitude release is a different time (0.5 + 0.5)
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

  it("passes offset (in seconds) straight to source.start", () => {
    const { sources } = makeVoice({ offset: 0.5 });
    expect(sources[0].startedOffset).toBeCloseTo(0.5);
  });

  it("mirrors offset against buffer duration when reversed", () => {
    // buffer.duration = 2.0; reversed offset 0.5s → 2.0 - 0.5 = 1.5s
    const { sources } = makeVoice({ offset: 0.5, reverse: true });
    expect(sources[0].startedOffset).toBeCloseTo(1.5);
  });
});

// ---------------------------------------------------------------------------
// stop()
// ---------------------------------------------------------------------------

describe("stop()", () => {
  it("with time after startAt: ramps envelope and stops source at t + ampRelease", () => {
    const { voice, sources, gains } = makeVoice(
      { ampRelease: 0.5 },
      { currentTime: 1 },
    );
    const envelope = gains[1];

    voice.stop(2); // time=2, startAt=1

    expect(envelope.gain.cancelScheduledValues).toHaveBeenCalledWith(2);
    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1.0, 2);
    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 2.5); // 2 + 0.5
    expect(sources[0].stoppedAt).toBe(2.5);
  });

  it("with no time argument: uses context.currentTime", () => {
    const { voice, sources, gains } = makeVoice(
      { ampRelease: 0.3 },
      { currentTime: 1 },
    );
    const envelope = gains[1];

    voice.stop(); // no time → uses currentTime=1, startAt=1 → t <= startAt

    // currentTime (1) <= startAt (1): immediate stop path
    expect(sources[0].stoppedAt).toBe(1);
    expect(envelope.gain.cancelScheduledValues).toHaveBeenCalledWith(1);
  });

  it("with time at or before startAt: stops source immediately without envelope", () => {
    const { voice, sources, gains } = makeVoice({}, { startTime: 2 });
    const envelope = gains[1];

    voice.stop(1); // time=1 ≤ startAt=2

    expect(sources[0].stoppedAt).toBe(1);
    expect(envelope.gain.cancelScheduledValues).toHaveBeenCalledWith(1);
  });

  it("overrides stop time when called again with an earlier time", () => {
    const { voice, sources } = makeVoice(
      { ampRelease: 0.5 },
      { currentTime: 1 },
    );

    voice.stop(3);
    voice.stop(2);

    // The earlier stop time wins: release starts at 2 and ends at 2 + 0.5
    expect(sources[0].stoppedAt).toBe(2.5);
    const stopCallCount = jest.fn();
    sources[0].stop = stopCallCount;

    voice.stop(2); // third call — should do nothing
    expect(stopCallCount).not.toHaveBeenCalled();
  });

  it("stopped mid-attack: starts the release ramp from the attack's interpolated value, not 1.0", () => {
    // ampAttack=1s starting at startAt=0 -> at t=0.25 the attack ramp is 25% of the way up.
    const { voice, sources, gains } = makeVoice(
      { ampAttack: 1, ampRelease: 0.5 },
      { currentTime: 0 },
    );
    const envelope = gains[1];

    voice.stop(0.25);

    expect(envelope.gain.cancelScheduledValues).toHaveBeenCalledWith(0.25);
    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.25,
      0.25,
    );
    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.75); // 0.25 + ampRelease(0.5)
    expect(sources[0].stoppedAt).toBe(0.75);
  });

  it("stopped after the attack completes: starts the release ramp from 1.0, same as ampAttack = 0", () => {
    const { voice, gains } = makeVoice(
      { ampAttack: 0.2, ampRelease: 0.5 },
      { currentTime: 0 },
    );
    const envelope = gains[1];

    voice.stop(1); // well past the 0.2s attack

    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1.0, 1);
  });

  it("stopped mid-decay: starts the release ramp from the decay's interpolated value", () => {
    // ampDecay=1s (full decay time) from 1 -> ampSustain=0, starting at startAt=0 ->
    // at t=0.5 the decay is 50% of the way down: 1 + (0-1)*0.5 = 0.5
    const { voice, sources, gains } = makeVoice(
      { ampDecay: 1, ampSustain: 0, ampRelease: 0.3 },
      { currentTime: 0 },
    );
    const envelope = gains[1];

    voice.stop(0.5);

    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.5,
      0.5,
    );
    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.8); // 0.5 + ampRelease(0.3)
    expect(sources[0].stoppedAt).toBe(0.8);
  });

  it("stopped during sustain: starts the release ramp from ampSustain, not 1.0", () => {
    const { voice, gains } = makeVoice(
      { ampDecay: 0.1, ampSustain: 0.4, ampRelease: 0.2 },
      { currentTime: 0 },
    );
    const envelope = gains[1];

    voice.stop(1); // well past the 0.1s decay - sitting in sustain

    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.4, 1);
  });

  it("ignores repeated calls with a later or same time", () => {
    const { voice, sources } = makeVoice(
      { ampRelease: 0.5 },
      { currentTime: 1 },
    );

    voice.stop(2);
    voice.stop(2);

    // source.stop called exactly once
    expect(sources[0].stoppedAt).toBe(2.5);
    // Only one stop call — second stop() returned early
    // Verify by checking the source was only stopped once (stoppedAt set once)
    const stopCallCount = jest.fn();
    sources[0].stop = stopCallCount;

    voice.stop(2); // same time - should do nothing
    voice.stop(3); // later time - should do nothing
    expect(stopCallCount).not.toHaveBeenCalled();
  });
});

describe("LFO cleanup", () => {
  it("stops LFO oscillators when the source ends on its own", () => {
    const { sources, oscillators } = makeVoice({
      modLfoToPitch: 100,
      vibLfoToPitch: 50,
    });
    expect(oscillators).toHaveLength(2);
    const stops = oscillators.map((o) => jest.spyOn(o, "stop"));

    sources[0].triggerEnded();

    stops.forEach((stop) => expect(stop).toHaveBeenCalled());
    oscillators.forEach((o) => expect(o.disconnect).toHaveBeenCalled());
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

describe("endTime", () => {
  it("is open-ended until stop() is called", () => {
    const { voice } = makeVoice();
    expect(voice.endTime).toBe(Infinity);
  });

  it("is the stop time plus the release, even when the stop is scheduled ahead", () => {
    const { voice } = makeVoice({ ampRelease: 0.5 }, { startTime: 1 });
    voice.stop(3);
    expect(voice.endTime).toBe(3.5);
  });

  it("is the start time when the voice was cancelled before it sounded", () => {
    const { voice } = makeVoice({ ampRelease: 0.5 }, { startTime: 2 });
    voice.stop(1);
    expect(voice.endTime).toBe(2);
  });
});

describe("steal()", () => {
  it("fades out quickly from the given time and updates endTime", () => {
    const { voice, sources, gains } = makeVoice(
      { ampRelease: 2 },
      { currentTime: 0 },
    );
    const envelope = gains[1];

    voice.steal(1);

    expect(envelope.gain.cancelScheduledValues).toHaveBeenCalledWith(1);
    expect(envelope.gain.setValueAtTime).toHaveBeenCalledWith(1.0, 1);
    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.01);
    expect(sources[0].stoppedAt).toBe(1.01);
    expect(voice.endTime).toBe(1.01);
    expect(voice.isReleasing).toBe(true);
  });

  it("cuts short a release that is already running (stop() ignores a later time)", () => {
    const { voice, sources } = makeVoice({ ampRelease: 5 }, { currentTime: 0 });
    voice.stop(1); // would fade until 6

    voice.steal(2);

    expect(sources[0].stoppedAt).toBe(2.01);
    expect(voice.endTime).toBe(2.01);
  });

  it("starts from where the running release has got to, not from full volume", () => {
    const { voice, gains } = makeVoice({ ampRelease: 4 }, { currentTime: 0 });
    const envelope = gains[1];
    voice.stop(1); // falls linearly 1 -> 0 over 1..5

    voice.steal(2); // a quarter of the way down

    expect(envelope.gain.setValueAtTime).toHaveBeenLastCalledWith(0.75, 2);
  });

  it("uses a custom fade time", () => {
    const { voice } = makeVoice({ ampRelease: 2 }, { currentTime: 0 });
    voice.steal(1, 0.05);
    expect(voice.endTime).toBeCloseTo(1.05);
  });

  it("does nothing when the voice already ends within the fade", () => {
    const { voice, sources } = makeVoice(
      { ampRelease: 0.005 },
      { currentTime: 0 },
    );
    voice.stop(1); // ends at 1.005
    sources[0].stoppedAt = undefined;

    voice.steal(1);

    expect(sources[0].stoppedAt).toBeUndefined();
    expect(voice.endTime).toBeCloseTo(1.005);
  });

  it("cancels a voice that hasn't started yet", () => {
    const { voice, sources } = makeVoice({}, { currentTime: 0, startTime: 3 });

    voice.steal(2);

    expect(sources[0].stoppedAt).toBe(2);
    expect(voice.endTime).toBe(3);
  });

  it("does nothing after the voice has ended", () => {
    const { voice, sources } = makeVoice({}, { currentTime: 0 });
    sources[0].triggerEnded();

    voice.steal(1);

    expect(sources[0].stoppedAt).toBeUndefined();
  });
});
