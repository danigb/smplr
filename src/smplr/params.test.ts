import { PARAM_DEFAULTS, resolveParams } from "./params";
import { PlaybackParams, SmplrGroup, SmplrRegion } from "./types";

function group(params: Partial<SmplrGroup> = {}): SmplrGroup {
  return { regions: [], ...params };
}

function region(params: Partial<SmplrRegion> & { sample?: string } = {}): SmplrRegion {
  return { sample: "test", ...params };
}

describe("resolveParams", () => {
  describe("inheritance cascade", () => {
    it("applies PARAM_DEFAULTS when nothing overrides", () => {
      const result = resolveParams(undefined, group(), region({ key: 60 }), 60, 100);
      expect(result.volume).toBe(0);
      expect(result.ampRelease).toBe(PARAM_DEFAULTS.ampRelease);
      expect(result.lpfCutoffHz).toBe(PARAM_DEFAULTS.lpfCutoffHz);
      expect(result.loop).toBe(false);
      expect(result.loopStart).toBe(0);
      expect(result.loopEnd).toBe(0);
      expect(result.offset).toBe(0);
    });

    it("json defaults override PARAM_DEFAULTS", () => {
      const defaults: PlaybackParams = { ampRelease: 1.0, volume: -6 };
      const result = resolveParams(defaults, group(), region({ key: 60 }), 60, 100);
      expect(result.ampRelease).toBe(1.0);
      expect(result.volume).toBe(-6);
    });

    it("group params override json defaults", () => {
      const defaults: PlaybackParams = { ampRelease: 1.0 };
      const g = group({ ampRelease: 0.5, lpfCutoffHz: 2000 });
      const result = resolveParams(defaults, g, region({ key: 60 }), 60, 100);
      expect(result.ampRelease).toBe(0.5);
      expect(result.lpfCutoffHz).toBe(2000);
    });

    it("region params override group params", () => {
      const g = group({ ampRelease: 0.5, loop: false });
      const r = region({ key: 60, ampRelease: 2.0, loop: true });
      const result = resolveParams(undefined, g, r, 60, 100);
      expect(result.ampRelease).toBe(2.0);
      expect(result.loop).toBe(true);
    });

    it("noteOverrides override region params", () => {
      const r = region({ key: 60, ampRelease: 2.0, lpfCutoffHz: 4000, loop: true });
      const result = resolveParams(undefined, group(), r, 60, 100, {
        ampRelease: 0.1,
        lpfCutoffHz: 1000,
        loop: false,
      });
      expect(result.ampRelease).toBe(0.1);
      expect(result.lpfCutoffHz).toBe(1000);
      expect(result.loop).toBe(false);
    });

    it("ignores non-PlaybackParams fields from group (keyRange, velRange, etc.)", () => {
      const g = group({ keyRange: [48, 72], velRange: [64, 127], ampRelease: 0.8 });
      const result = resolveParams(undefined, g, region({ key: 60 }), 60, 100);
      expect(result.ampRelease).toBe(0.8);
      expect((result as Record<string, unknown>).keyRange).toBeUndefined();
      expect((result as Record<string, unknown>).velRange).toBeUndefined();
    });
  });

  describe("detune calculation", () => {
    it("played note matches region pitch → 0 cents detune", () => {
      const result = resolveParams(undefined, group(), region({ key: 60 }), 60, 100);
      expect(result.detune).toBe(0);
    });

    it("played note above region pitch → positive cents", () => {
      // C4 (60) sample, play D4 (62): +2 semitones = +200 cents
      const result = resolveParams(undefined, group(), region({ key: 60 }), 62, 100);
      expect(result.detune).toBe(200);
    });

    it("played note below region pitch → negative cents", () => {
      // C4 (60) sample, play Bb3 (58): -2 semitones = -200 cents
      const result = resolveParams(undefined, group(), region({ key: 60 }), 58, 100);
      expect(result.detune).toBe(-200);
    });

    it("uses region.pitch over region.key for root pitch", () => {
      // sample has key:60 range but pitch is 62
      const r = region({ keyRange: [58, 64], pitch: 62 });
      // play 60: (60 - 62) = -2 semitones = -200 cents
      const result = resolveParams(undefined, group(), r, 60, 100);
      expect(result.detune).toBe(-200);
    });

    it("tune (semitones) shifts detune", () => {
      // tune: 1 → adds 100 cents on top of pitch transpose
      const r = region({ key: 60, tune: 1 });
      const result = resolveParams(undefined, group(), r, 60, 100);
      expect(result.detune).toBe(100);
    });

    it("tune applied via group level", () => {
      const g = group({ tune: -1 });
      const result = resolveParams(undefined, g, region({ key: 60 }), 60, 100);
      expect(result.detune).toBe(-100);
    });

    it("region.detune (cents) adds fine offset after semitone calculation", () => {
      const r = region({ key: 60, detune: 50 });
      const result = resolveParams(undefined, group(), r, 60, 100);
      expect(result.detune).toBe(50);
    });

    it("combined: pitch transpose + tune + detune", () => {
      // play 62, pitch 60 → +200 cents; tune=1 → +100 cents; detune=25 → +25 cents
      const r = region({ key: 60, tune: 1, detune: 25 });
      const result = resolveParams(undefined, group(), r, 62, 100);
      expect(result.detune).toBe(200 + 100 + 25);
    });

    it("noteOverrides.detune adds to computed detune", () => {
      // play 62, pitch 60 → 200 cents; noteOverrides.detune = -50
      const result = resolveParams(undefined, group(), region({ key: 60 }), 62, 100, {
        detune: -50,
      });
      expect(result.detune).toBe(150);
    });

    it("fallback: no pitch or key → treat sample as tuned to played note (0 cents)", () => {
      // region has keyRange but no pitch/key
      const r = region({ keyRange: [58, 64] });
      const result = resolveParams(undefined, group(), r, 60, 100);
      expect(result.detune).toBe(0);
    });
  });

  describe("velocity", () => {
    it("passes velocity through unchanged", () => {
      const result = resolveParams(undefined, group(), region({ key: 60 }), 60, 80);
      expect(result.velocity).toBe(80);
    });
  });

  describe("ampVelCurve", () => {
    it("passes ampVelCurve from region", () => {
      const r = region({ key: 60, ampVelCurve: [64, 0.5] });
      const result = resolveParams(undefined, group(), r, 60, 100);
      expect(result.ampVelCurve).toEqual([64, 0.5]);
    });

    it("is undefined when region has no ampVelCurve", () => {
      const result = resolveParams(undefined, group(), region({ key: 60 }), 60, 100);
      expect(result.ampVelCurve).toBeUndefined();
    });
  });
});
