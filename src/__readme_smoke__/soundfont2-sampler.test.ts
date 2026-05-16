/**
 * README smoke tests — Soundfont2Sampler
 *
 * Covers L824–L835: the documented two-phase load semantic.
 *  1. `await sampler.load` resolves after the .sf2 parse.
 *  2. `sampler.instrumentNames` is populated.
 *  3. `sampler.loadInstrument(name)` returns Promise<void> | undefined.
 */

import { Soundfont2Sampler } from "../";
import { makeContext, stubFetch } from "./helpers";

const FAKE_SF2 = {
  instruments: [
    {
      header: { name: "Galaxy EP1" },
      zones: [],
    },
    {
      header: { name: "Galaxy EP2" },
      zones: [],
    },
  ],
};

describe("README — Soundfont2Sampler", () => {
  beforeEach(stubFetch);

  it("L824: construct, await load, list instrument names, load one (two-phase)", async () => {
    const context = makeContext();
    const sampler = new Soundfont2Sampler(context, {
      url: "https://example.test/galaxy-electric-pianos.sf2",
      createSoundfont: () => FAKE_SF2 as any,
    });

    // Phase 1 — .load resolves after the .sf2 binary is parsed.
    await sampler.load;

    // Phase 2 — instrumentNames now populated; loadInstrument(name) triggers decode.
    expect(sampler.instrumentNames).toEqual(["Galaxy EP1", "Galaxy EP2"]);
    const decoded = sampler.loadInstrument(sampler.instrumentNames[0]);
    expect(decoded).toBeDefined();
    await decoded;
  });

  it("L824: `loadInstrument(unknown)` returns undefined", async () => {
    const context = makeContext();
    const sampler = await new Soundfont2Sampler(context, {
      url: "https://example.test/galaxy.sf2",
      createSoundfont: () => FAKE_SF2 as any,
    }).load;

    expect(sampler.loadInstrument("does-not-exist")).toBeUndefined();
  });
});
