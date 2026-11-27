import { MIN_RAMP_VALUE, ParamRamp } from "./param-ramp";

function makeParam() {
  const calls: [string, number, number][] = [];
  return {
    calls,
    param: {
      cancelScheduledValues: (t: number) => calls.push(["cancel", NaN, t]),
      setValueAtTime: (v: number, t: number) => calls.push(["set", v, t]),
      exponentialRampToValueAtTime: (v: number, t: number) =>
        calls.push(["exp", v, t]),
    } as unknown as AudioParam,
  };
}

describe("ParamRamp", () => {
  it("valueAt returns base before any ramp", () => {
    const { param } = makeParam();
    const r = new ParamRamp(param, 0.5);
    expect(r.valueAt(0)).toBe(0.5);
    expect(r.valueAt(100)).toBe(0.5);
  });

  it("first ramp starts from base", () => {
    const { param, calls } = makeParam();
    const r = new ParamRamp(param, 1);
    r.rampTo(2, 1, 3);
    expect(calls).toEqual([
      ["cancel", NaN, 3],
      ["set", 1, 3],
      ["exp", 2, 4],
    ]);
  });

  it("interpolates exponentially inside a ramp", () => {
    const { param } = makeParam();
    const r = new ParamRamp(param, 1);
    r.rampTo(4, 2, 0);
    expect(r.valueAt(-1)).toBe(1);
    expect(r.valueAt(1)).toBeCloseTo(2);
    expect(r.valueAt(2)).toBe(4);
    expect(r.valueAt(5)).toBe(4);
  });

  it("a ramp mid-ramp starts from the interpolated value", () => {
    const { param, calls } = makeParam();
    const r = new ParamRamp(param, 1);
    r.rampTo(4, 2, 0);
    calls.length = 0;
    r.rampTo(1, 1, 1);
    expect(calls[0]).toEqual(["cancel", NaN, 1]);
    expect(calls[1][0]).toBe("set");
    expect(calls[1][1]).toBeCloseTo(2);
    expect(calls[2]).toEqual(["exp", 1, 2]);
  });

  it("a ramp after a finished ramp starts from its target", () => {
    const { param, calls } = makeParam();
    const r = new ParamRamp(param, 1);
    r.rampTo(0.5, 1, 0);
    calls.length = 0;
    r.rampTo(1, 1, 5);
    expect(calls[1]).toEqual(["set", 0.5, 5]);
  });

  it("duration 0 sets the value immediately", () => {
    const { param, calls } = makeParam();
    const r = new ParamRamp(param, 1);
    r.rampTo(3, 0, 2);
    expect(calls).toEqual([
      ["cancel", NaN, 2],
      ["set", 3, 2],
    ]);
    expect(r.valueAt(2)).toBe(3);
  });

  it("clamps targets to MIN_RAMP_VALUE", () => {
    const { param, calls } = makeParam();
    const r = new ParamRamp(param, 1);
    r.rampTo(0, 1, 0);
    expect(calls[2]).toEqual(["exp", MIN_RAMP_VALUE, 1]);
  });

  it("moves a ramp requested before the previous start forward", () => {
    const { param, calls } = makeParam();
    const r = new ParamRamp(param, 1);
    r.rampTo(2, 1, 5);
    calls.length = 0;
    r.rampTo(3, 1, 2);
    expect(calls[0]).toEqual(["cancel", NaN, 5]);
    expect(calls[2]).toEqual(["exp", 3, 6]);
  });
});
