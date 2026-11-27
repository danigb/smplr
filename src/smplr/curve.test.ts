import { evalCurve } from "./curve";
import {
  DEFAULT_AMP_VEL_DB,
  midiVelToGain,
  velocityToGain,
} from "./volume";
import { resolveParams } from "./params";

describe("evalCurve", () => {
  it("linear is the identity, clamped to 0..1", () => {
    expect(evalCurve("linear", 0.3)).toBe(0.3);
    expect(evalCurve("linear", -1)).toBe(0);
    expect(evalCurve("linear", 2)).toBe(1);
  });

  it("soft and hard presets are power curves", () => {
    expect(evalCurve("soft", 0.5)).toBeCloseTo(Math.pow(0.5, 0.6));
    expect(evalCurve("hard", 0.5)).toBeCloseTo(Math.pow(0.5, 1.6));
    expect(evalCurve("soft", 0.5)).toBeGreaterThan(0.5);
    expect(evalCurve("hard", 0.5)).toBeLessThan(0.5);
  });

  it("interpolates breakpoints linearly and is flat outside them", () => {
    const c: [number, number][] = [
      [0.2, 0.1],
      [0.6, 0.9],
    ];
    expect(evalCurve(c, 0)).toBe(0.1);
    expect(evalCurve(c, 0.4)).toBeCloseTo(0.5);
    expect(evalCurve(c, 1)).toBe(0.9);
  });

  it("accepts unsorted breakpoints", () => {
    expect(
      evalCurve(
        [
          [1, 1],
          [0, 0],
          [0.5, 0.2],
        ],
        0.25,
      ),
    ).toBeCloseTo(0.1);
  });

  it("an empty list is the identity", () => {
    expect(evalCurve([], 0.7)).toBe(0.7);
  });
});

describe("velocityToGain", () => {
  const defaults = { track: 1, db: DEFAULT_AMP_VEL_DB };

  it("defaults equal midiVelToGain exactly for every velocity", () => {
    for (let v = 0; v <= 127; v++) {
      expect(velocityToGain(v, defaults)).toBe(midiVelToGain(v));
    }
  });

  it("the default db is the square law (non-fast path agrees)", () => {
    // A curve-free call with db nudged by 0 through a different object still matches
    expect(velocityToGain(64, { track: 0.999999999, db: DEFAULT_AMP_VEL_DB }))
      .toBeCloseTo(midiVelToGain(64), 6);
  });

  it("track 0 gives full gain at any velocity", () => {
    expect(velocityToGain(1, { ...defaults, track: 0 })).toBe(1);
    expect(velocityToGain(127, { ...defaults, track: 0 })).toBe(1);
  });

  it("track 0.5 mixes half way", () => {
    expect(velocityToGain(0, { ...defaults, track: 0.5 })).toBeCloseTo(0.5);
  });

  it("db sets the attenuation at velocity 1", () => {
    const g = velocityToGain(1, { track: 1, db: 30 });
    expect(20 * Math.log10(g)).toBeCloseTo(-30, 2);
    expect(velocityToGain(127, { track: 1, db: 30 })).toBeCloseTo(1);
  });

  it("an explicit curve replaces db", () => {
    expect(
      velocityToGain(127 / 2, {
        track: 1,
        db: 30,
        curve: [
          [0, 0.2],
          [1, 1],
        ],
      }),
    ).toBeCloseTo(0.6);
  });
});

describe("resolveParams velocity fields", () => {
  const group = { regions: [] };

  it("inherits ampVel* through defaults -> group -> region", () => {
    const params = resolveParams(
      { ampVelDb: 40 },
      { regions: [], ampVelTrack: 0.5 },
      { sample: "a", ampVelCurve: "soft" },
      60,
      100,
    );
    expect(params.ampVelDb).toBe(40);
    expect(params.ampVelTrack).toBe(0.5);
    expect(params.ampVelCurve).toBe("soft");
  });

  it("defaults to track 1, the square-law db and no curve", () => {
    const params = resolveParams(undefined, group, { sample: "a" }, 60, 100);
    expect(params.ampVelTrack).toBe(1);
    expect(params.ampVelDb).toBe(DEFAULT_AMP_VEL_DB);
    expect(params.ampVelCurve).toBeUndefined();
  });
});
