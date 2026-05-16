/**
 * README smoke tests — ElectricPiano
 *
 * Covers Spec 03's CD-2 invariant: `epiano.tremolo.level(n)` (L727) must be
 * callable *immediately* after construction, before `load` resolves.
 */

import { ElectricPiano, getElectricPianoNames } from "../";
import { makeContext, stubFetch } from "./helpers";

describe("README — ElectricPiano", () => {
  beforeEach(stubFetch);

  it("L718: getElectricPianoNames returns the documented instrument list", () => {
    expect(getElectricPianoNames()).toEqual(
      expect.arrayContaining(["CP80", "PianetT", "WurlitzerEP200"])
    );
  });

  it("L720: `new ElectricPiano(ctx, { instrument })` constructs", () => {
    const epiano = new ElectricPiano(makeContext(), { instrument: "PianetT" });
    epiano.load.catch(() => {});
    expect(typeof epiano.start).toBe("function");
    expect(typeof epiano.stop).toBe("function");
  });

  it("L727: `epiano.tremolo.level(30)` callable before load resolves (CD-2 sync extras)", () => {
    const epiano = new ElectricPiano(makeContext(), { instrument: "PianetT" });
    epiano.load.catch(() => {});
    // Documented one-liner — extras are observable *before* `await load`.
    expect(typeof epiano.tremolo.level).toBe("function");
    expect(() => epiano.tremolo.level(30)).not.toThrow();
  });
});
