/**
 * Soundfont2 — two-phase load semantics.
 *
 * (Rescued from the former README smoke harness: the only tests covering the
 * documented `await ready` → `instrumentNames` → `loadInstrument(name)` flow.)
 */

import { Soundfont2, sf2InstrumentToPreset } from "./soundfont2";
import { createAudioContextMock } from "./test-helpers";

function makeContext(): AudioContext {
  return createAudioContextMock().context;
}

function stubFetch(): void {
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    arrayBuffer: async () => new ArrayBuffer(0),
  });
}

const FAKE_SF2 = {
  instruments: [
    { header: { name: "Galaxy EP1" }, zones: [] },
    { header: { name: "Galaxy EP2" }, zones: [] },
  ],
};

describe("Soundfont2", () => {
  beforeEach(stubFetch);

  it("construct → await ready → list instrumentNames → loadInstrument(name)", async () => {
    const sampler = Soundfont2(makeContext(), {
      url: "https://example.test/galaxy-electric-pianos.sf2",
      createSoundfont: () => FAKE_SF2 as any,
    });

    // Phase 1 — ready resolves after the .sf2 binary is parsed.
    await sampler.ready;

    // Phase 2 — instrumentNames populated; loadInstrument(name) triggers decode.
    expect(sampler.instrumentNames).toEqual(["Galaxy EP1", "Galaxy EP2"]);
    const decoded = sampler.loadInstrument(sampler.instrumentNames[0]);
    expect(decoded).toBeDefined();
    await decoded;
  });

  it("loadInstrument(unknown) throws a clear error", async () => {
    const sampler = Soundfont2(makeContext(), {
      url: "https://example.test/galaxy.sf2",
      createSoundfont: () => FAKE_SF2 as any,
    });
    await sampler.ready;

    expect(() => sampler.loadInstrument("does-not-exist")).toThrow(
      /instrument "does-not-exist" not found/,
    );
  });
});

describe("sf2InstrumentToPreset", () => {
  function makeSample(name: string, originalPitch: number) {
    return {
      data: new Int16Array([0, 1000, -1000, 0]),
      header: {
        name,
        sampleRate: 44100,
        originalPitch,
        pitchCorrection: 0,
        start: 0,
        end: 4,
        startLoop: -1,
        endLoop: -1,
      },
    };
  }

  it("uses the sample's originalPitch when no zone rootKey is set", () => {
    const { json } = sf2InstrumentToPreset(
      {
        header: { name: "Test" },
        zones: [{ sample: makeSample("s1", 60), keyRange: { lo: 0, hi: 127 } }],
      },
      createAudioContextMock().context,
    );

    expect(json.groups[0].regions[0].pitch).toBe(60);
  });

  it("prefers the zone's rootKey (SF2 overridingRootKey) over the stale sample header pitch", () => {
    // Mirrors real-world SF2 files where every sample header reports the
    // same stale originalPitch and the true per-zone root key only exists as the
    // overridingRootKey generator, surfaced here as Sf2Zone.rootKey.
    const { json } = sf2InstrumentToPreset(
      {
        header: { name: "Test" },
        zones: [
          {
            sample: makeSample("high", 60),
            keyRange: { lo: 105, hi: 108 },
            rootKey: 108,
          },
          {
            sample: makeSample("mid", 60),
            keyRange: { lo: 100, hi: 104 },
            rootKey: 104,
          },
        ],
      },
      createAudioContextMock().context,
    );

    expect(json.groups[0].regions[0].pitch).toBe(108);
    expect(json.groups[0].regions[1].pitch).toBe(104);
  });

  it.each([-1, 128])(
    "ignores an out-of-range rootKey (%d, SF2's 'unset') and uses the sample header pitch",
    (rootKey) => {
      const { json } = sf2InstrumentToPreset(
        {
          header: { name: "Test" },
          zones: [
            {
              sample: makeSample("s1", 60),
              keyRange: { lo: 0, hi: 127 },
              rootKey,
            },
          ],
        },
        createAudioContextMock().context,
      );

      expect(json.groups[0].regions[0].pitch).toBe(60);
    },
  );
});
