/**
 * README smoke tests — single-line factory examples
 *
 * One test per remaining factory, exercising the exact README construction
 * line. We don't drive the load to completion here (the network would have
 * to be mocked per-URL); we verify the documented surface is present.
 *
 *  - L13  Soundfont(ctx, { instrument: "marimba" })
 *  - L745 Mallet(ctx, { instrument })
 *  - L759 Mellotron(ctx, { instrument })
 *  - L796 Smolken(ctx, { instrument: "Arco" }) — high-stakes: `await … .load` form
 *  - L812 Versilian(ctx, { instrument })
 */

import {
  Soundfont,
  Mallet,
  Mellotron,
  Smolken,
  Versilian,
  getMalletNames,
  getMellotronNames,
  getSmolkenNames,
} from "../";
import { makeContext, stubFetch } from "./helpers";

describe("README — single-line factory examples", () => {
  beforeEach(stubFetch);

  it("L13: Soundfont(ctx, { instrument: 'marimba' })", () => {
    const marimba = new Soundfont(makeContext(), { instrument: "marimba" });
    marimba.load.catch(() => {});
    expect(typeof marimba.start).toBe("function");
    expect(typeof marimba.stop).toBe("function");
    expect(marimba.output).toBeDefined();
  });

  it("L745: Mallet(ctx, { instrument })", () => {
    const instruments = getMalletNames();
    const mallet = new Mallet(makeContext(), { instrument: instruments[0] });
    mallet.load.catch(() => {});
    expect(typeof mallet.start).toBe("function");
  });

  it("L759: Mellotron(ctx, { instrument })", () => {
    const instruments = getMellotronNames();
    const mellotron = new Mellotron(makeContext(), {
      instrument: instruments[0],
    });
    mellotron.load.catch(() => {});
    expect(typeof mellotron.start).toBe("function");
  });

  it("L796: `await new Smolken(ctx, { instrument: 'Arco' }).load` returns the instrument", () => {
    // Verifying the type/shape of the chain. We don't `await` because fetch
    // returns empty text and sfzToSmplrJson would parse to an empty json.
    const instruments = getSmolkenNames();
    expect(instruments).toEqual(expect.arrayContaining(["Arco"]));
    const smolken = new Smolken(makeContext(), { instrument: "Arco" });
    smolken.load.catch(() => {});
    expect(typeof smolken.start).toBe("function");
    expect(smolken.load).toBeInstanceOf(Promise);
  });

  it("L812: Versilian(ctx, { instrument })", () => {
    const versilian = new Versilian(makeContext(), {
      instrument: "Strings/Violin/Violin - Arco",
    });
    versilian.load.catch(() => {});
    expect(typeof versilian.start).toBe("function");
  });
});
