import {
  computeAdsrTimes,
  hasAdsrShape,
  adsrValueAt,
  scheduleAdsr,
  scheduleAdsrRelease,
  AdsrParams,
} from "./envelope";

function makeGainParam() {
  return {
    value: 1,
    cancelScheduledValues: jest.fn(),
    setValueAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
  };
}

const FLAT: AdsrParams = { delay: 0, attack: 0, hold: 0, decay: 0, sustain: 1 };

describe("computeAdsrTimes", () => {
  it("resolves phase boundaries relative to startAt", () => {
    const times = computeAdsrTimes(1, {
      delay: 0.1,
      attack: 0.2,
      hold: 0.3,
      decay: 1,
      sustain: 0.5,
    });
    expect(times.delayEnd).toBeCloseTo(1.1);
    expect(times.attackEnd).toBeCloseTo(1.3);
    expect(times.holdEnd).toBeCloseTo(1.6);
    // decay to sustain=0.5 only takes 50% of the full (100%) decay time
    expect(times.decayEnd).toBeCloseTo(2.1);
    expect(times.sustainLevel).toBe(0.5);
  });

  it("decayEnd = holdEnd when sustain = 1 (nothing to decay to), regardless of decay time", () => {
    const times = computeAdsrTimes(0, { ...FLAT, decay: 5, sustain: 1 });
    expect(times.decayEnd).toBe(times.holdEnd);
  });
});

describe("hasAdsrShape", () => {
  it("false when every phase is at its flat default (sustain = 1, no timing)", () => {
    const times = computeAdsrTimes(0, FLAT);
    expect(hasAdsrShape(0, times)).toBe(false);
  });

  it("true when sustain < 1, even with zero timing", () => {
    const times = computeAdsrTimes(0, { ...FLAT, sustain: 0.5 });
    expect(hasAdsrShape(0, times)).toBe(true);
  });

  it("true when any timing phase is non-zero", () => {
    expect(hasAdsrShape(0, computeAdsrTimes(0, { ...FLAT, delay: 0.1 }))).toBe(
      true,
    );
    expect(hasAdsrShape(0, computeAdsrTimes(0, { ...FLAT, attack: 0.1 }))).toBe(
      true,
    );
    expect(hasAdsrShape(0, computeAdsrTimes(0, { ...FLAT, hold: 0.1 }))).toBe(
      true,
    );
  });
});

describe("adsrValueAt", () => {
  it("0 during delay", () => {
    const times = computeAdsrTimes(0, { ...FLAT, delay: 1, attack: 1 });
    expect(adsrValueAt(times, 0.5)).toBe(0);
  });

  it("linearly interpolates through attack", () => {
    const times = computeAdsrTimes(0, { ...FLAT, attack: 1 });
    expect(adsrValueAt(times, 0.25)).toBeCloseTo(0.25);
    expect(adsrValueAt(times, 0.75)).toBeCloseTo(0.75);
  });

  it("1 during hold", () => {
    const times = computeAdsrTimes(0, { ...FLAT, attack: 0.2, hold: 1 });
    expect(adsrValueAt(times, 0.5)).toBe(1);
  });

  it("linearly interpolates through decay toward sustain", () => {
    const times = computeAdsrTimes(0, { ...FLAT, decay: 1, sustain: 0 });
    expect(adsrValueAt(times, 0.5)).toBeCloseTo(0.5);
  });

  it("holds at sustainLevel indefinitely after decay", () => {
    const times = computeAdsrTimes(0, { ...FLAT, decay: 1, sustain: 0.3 });
    expect(adsrValueAt(times, 1000)).toBeCloseTo(0.3);
  });
});

describe("scheduleAdsrRelease", () => {
  it("starts the release ramp from the envelope's interpolated value at t, not 1.0", () => {
    const gain = makeGainParam();
    const times = computeAdsrTimes(0, { ...FLAT, attack: 1 });

    const stopAt = scheduleAdsrRelease(
      gain as unknown as AudioParam,
      times,
      0.25,
      0.5,
    );

    expect(gain.cancelScheduledValues).toHaveBeenCalledWith(0.25);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.25, 0.25); // keeps the attack curve up to t
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.75);
    expect(stopAt).toBe(0.75);
  });
});

describe("scheduleAdsrRelease when the stop is scheduled ahead", () => {
  /** every automation call on the param, in order, as [method, ...args] */
  function recordingParam() {
    const calls: unknown[][] = [];
    const record =
      (name: string) =>
      (...args: unknown[]) =>
        calls.push([name, ...args]);
    return {
      calls,
      param: {
        cancelScheduledValues: record("cancel"),
        setValueAtTime: record("set"),
        linearRampToValueAtTime: record("linear"),
        exponentialRampToValueAtTime: record("exp"),
      } as unknown as AudioParam,
    };
  }

  it("mid-attack: cancels, ramps to the value reached at t, then releases", () => {
    // 1s attack, stop at 0.5 (e.g. start({ duration: 0.5 })): the attack ramp ending at 1 is
    // cancelled, so something has to keep the curve rising until 0.5.
    const { calls, param } = recordingParam();
    const times = computeAdsrTimes(0, { ...FLAT, attack: 1 });

    scheduleAdsrRelease(param, times, 0.5, 0.25);

    expect(calls).toEqual([
      ["cancel", 0.5],
      ["linear", 0.5, 0.5],
      ["linear", 0, 0.75],
    ]);
  });

  it("mid-decay: cancels, ramps to the value reached at t, then releases", () => {
    // full decay 1s, sustain 0 -> at t=0.25 the decay is a quarter of the way down
    const { calls, param } = recordingParam();
    const times = computeAdsrTimes(0, { ...FLAT, decay: 1, sustain: 0 });

    scheduleAdsrRelease(param, times, 0.25, 0.5);

    expect(calls).toEqual([
      ["cancel", 0.25],
      ["linear", 0.75, 0.25],
      ["linear", 0, 0.75],
    ]);
  });

  it("uses the mapping's ramp type for the catch-up ramp too (exponential for filter cutoff)", () => {
    const { calls, param } = recordingParam();
    const times = computeAdsrTimes(0, { ...FLAT, attack: 1 });
    const octave = {
      toValue: (env: number) => 1000 * 2 ** env,
      ramp: "exponential" as const,
    };

    scheduleAdsrRelease(param, times, 0.5, 1, octave);

    expect(calls).toEqual([
      ["cancel", 0.5],
      ["exp", 1000 * 2 ** 0.5, 0.5],
      ["exp", 1000, 1.5],
    ]);
  });
});

describe("envelope mapping (modulation targets)", () => {
  const octave = {
    toValue: (env: number) => 1000 * 2 ** env,
    ramp: "exponential" as const,
  };

  it("scheduleAdsr maps envelope values into the param's units with the requested ramp", () => {
    const param = makeGainParam();
    const times = computeAdsrTimes(0, { ...FLAT, attack: 1, sustain: 0.5 });

    scheduleAdsr(param as unknown as AudioParam, 0, times, octave);

    expect(param.setValueAtTime).toHaveBeenCalledWith(1000, 0);
    expect(param.exponentialRampToValueAtTime).toHaveBeenCalledWith(2000, 1);
    expect(param.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      1000 * 2 ** 0.5,
      times.decayEnd,
    );
    expect(param.linearRampToValueAtTime).not.toHaveBeenCalled();
  });

  it("scheduleAdsrRelease starts from the mapped current value and ramps to the mapped resting value", () => {
    const param = makeGainParam();
    const times = computeAdsrTimes(0, { ...FLAT, attack: 1 });

    const stopAt = scheduleAdsrRelease(
      param as unknown as AudioParam,
      times,
      0.5,
      2,
      octave,
    );

    expect(param.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      1000 * 2 ** 0.5,
      0.5,
    );
    expect(param.exponentialRampToValueAtTime).toHaveBeenCalledWith(1000, 2.5);
    expect(stopAt).toBe(2.5);
  });
});
