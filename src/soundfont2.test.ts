/**
 * Soundfont2 — two-phase load semantics.
 *
 * (Rescued from the former README smoke harness: the only tests covering the
 * documented `await ready` → `instrumentNames` → `loadInstrument(name)` flow.)
 */

import { Soundfont2 } from "./soundfont2";
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
