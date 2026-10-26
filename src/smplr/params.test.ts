import { PARAM_DEFAULTS, resolveParams } from "./params";
import { PlaybackParams, SmplrGroup, SmplrRegion } from "./types";

function group(params: Partial<SmplrGroup> = {}): SmplrGroup {
  return { regions: [], ...params };
}

function region(
  params: Partial<SmplrRegion> & { sample?: string } = {},
): SmplrRegion {
  return { sample: "test", ...params };
}

describe("resolveParams", () => {
  describe("inheritance cascade", () => {
    it("applies PARAM_DEFAULTS when nothing overrides", () => {
      const result = resolveParams(
        undefined,
        group(),
        region({ key: 60 }),
        60,
        100,
      );
      expect(result.volume).toBe(0);
      expect(result.pan).toBe(PARAM_DEFAULTS.pan);
      expect(result.ampRelease).toBe(PARAM_DEFAULTS.ampRelease);
      expect(result.lpfCutoffHz).toBe(PARAM_DEFAULTS.lpfCutoffHz);
      expect(result.lpfQ).toBe(PARAM_DEFAULTS.lpfQ);
      expect(result.ampDelay).toBe(PARAM_DEFAULTS.ampDelay);
      expect(result.ampHold).toBe(PARAM_DEFAULTS.ampHold);
      expect(result.ampDecay).toBe(PARAM_DEFAULTS.ampDecay);
      expect(result.ampSustain).toBe(PARAM_DEFAULTS.ampSustain);
      expect(result.modLfoToPitch).toBe(PARAM_DEFAULTS.modLfoToPitch);
      expect(result.vibLfoToPitch).toBe(PARAM_DEFAULTS.vibLfoToPitch);
      expect(result.loop).toBe(false);
      expect(result.loopStart).toBe(0);
      expect(result.loopEnd).toBe(0);
      expect(result.offset).toBe(0);
    });

    it("json defaults override PARAM_DEFAULTS", () => {
      const defaults: PlaybackParams = { ampRelease: 1.0, volume: -6 };
      const result = resolveParams(
        defaults,
        group(),
        region({ key: 60 }),
        60,
        100,
      );
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

    it("region pan overrides group pan, which overrides PARAM_DEFAULTS", () => {
      const g = group({ pan: -0.5 });
      const r = region({ key: 60, pan: 0.75 });
      const result = resolveParams(undefined, g, r, 60, 100);
      expect(result.pan).toBe(0.75);

      const groupOnly = resolveParams(
        undefined,
        g,
        region({ key: 60 }),
        60,
        100,
      );
      expect(groupOnly.pan).toBe(-0.5);
    });

    it("region lpfQ overrides group lpfQ, which overrides PARAM_DEFAULTS", () => {
      const g = group({ lpfQ: 5 });
      const r = region({ key: 60, lpfQ: 12 });
      const result = resolveParams(undefined, g, r, 60, 100);
      expect(result.lpfQ).toBe(12);

      const groupOnly = resolveParams(
        undefined,
        g,
        region({ key: 60 }),
        60,
        100,
      );
      expect(groupOnly.lpfQ).toBe(5);
    });

    it("region ADSR params override group ADSR params, which override PARAM_DEFAULTS", () => {
      const g = group({
        ampDelay: 0.1,
        ampHold: 0.2,
        ampDecay: 0.3,
        ampSustain: 0.5,
      });
      const r = region({ key: 60, ampDecay: 0.9, ampSustain: 0.1 });
      const result = resolveParams(undefined, g, r, 60, 100);
      expect(result.ampDelay).toBe(0.1); // from group, region doesn't override
      expect(result.ampHold).toBe(0.2); // from group
      expect(result.ampDecay).toBe(0.9); // region overrides group
      expect(result.ampSustain).toBe(0.1); // region overrides group
    });

    it("region LFO params override group LFO params, which override PARAM_DEFAULTS", () => {
      const g = group({ modLfoToPitch: 5, vibLfoRateHz: 6 });
      const r = region({ key: 60, modLfoToPitch: 20 });
      const result = resolveParams(undefined, g, r, 60, 100);
      expect(result.modLfoToPitch).toBe(20); // region overrides group
      expect(result.vibLfoRateHz).toBe(6); // from group
    });

    it("resolves modLfoToFilterFc and modLfoToVolume", () => {
      const r = region({ key: 60, modLfoToFilterFc: 300, modLfoToVolume: 50 });
      const result = resolveParams(undefined, group(), r, 60, 100);
      expect(result.modLfoToFilterFc).toBe(300);
      expect(result.modLfoToVolume).toBe(50);
    });

    it("resolves modulation envelope params (region overrides group, which overrides PARAM_DEFAULTS)", () => {
      const g = group({ modEnvDecay: 0.5, modEnvSustain: 0.2 });
      const r = region({ key: 60, modEnvToPitch: 400, modEnvSustain: 0.8 });
      const result = resolveParams(undefined, g, r, 60, 100);
      expect(result.modEnvToPitch).toBe(400);
      expect(result.modEnvDecay).toBe(0.5); // from group
      expect(result.modEnvSustain).toBe(0.8); // region overrides group
    });

    it("noteOverrides override region params", () => {
      const r = region({
        key: 60,
        ampRelease: 2.0,
        lpfCutoffHz: 4000,
        loop: true,
      });
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
      const g = group({
        keyRange: [48, 72],
        velRange: [64, 127],
        ampRelease: 0.8,
      });
      const result = resolveParams(undefined, g, region({ key: 60 }), 60, 100);
      expect(result.ampRelease).toBe(0.8);
      expect((result as Record<string, unknown>).keyRange).toBeUndefined();
      expect((result as Record<string, unknown>).velRange).toBeUndefined();
    });
  });

  describe("detune calculation", () => {
    it("played note matches region pitch → 0 cents detune", () => {
      const result = resolveParams(
        undefined,
        group(),
        region({ key: 60 }),
        60,
        100,
      );
      expect(result.detune).toBe(0);
    });

    it("played note above region pitch → positive cents", () => {
      // C4 (60) sample, play D4 (62): +2 semitones = +200 cents
      const result = resolveParams(
        undefined,
        group(),
        region({ key: 60 }),
        62,
        100,
      );
      expect(result.detune).toBe(200);
    });

    it("played note below region pitch → negative cents", () => {
      // C4 (60) sample, play Bb3 (58): -2 semitones = -200 cents
      const result = resolveParams(
        undefined,
        group(),
        region({ key: 60 }),
        58,
        100,
      );
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
      const result = resolveParams(
        undefined,
        group(),
        region({ key: 60 }),
        62,
        100,
        {
          detune: -50,
        },
      );
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
      const result = resolveParams(
        undefined,
        group(),
        region({ key: 60 }),
        60,
        80,
      );
      expect(result.velocity).toBe(80);
    });
  });
});
