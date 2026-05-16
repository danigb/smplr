/**
 * README smoke tests — SplendidGrandPiano
 *
 * Covers high-stakes examples called out in Spec 06 acceptance criteria:
 *  - L29  `new SplendidGrandPiano(context)`
 *  - L73  `const marimba = new SplendidGrandPiano(context); // create and load`
 *  - L112 `const piano = await new SplendidGrandPiano(context).load;`  (Pattern A→B preservation)
 *  - L122 `new SplendidGrandPiano(context, { onLoadProgress: … })`
 */

jest.mock("../smplr/load-audio", () => ({
  findFirstSupportedFormat: jest.fn().mockReturnValue("ogg"),
  loadAudioBuffer: jest.fn().mockResolvedValue({
    numberOfChannels: 1,
    length: 1,
    sampleRate: 44100,
  }),
}));

import { SplendidGrandPiano } from "../";
import { makeContext } from "./helpers";

describe("README — SplendidGrandPiano", () => {
  it("L29: `new SplendidGrandPiano(context)` constructs and exposes documented members", () => {
    const context = makeContext();
    const piano = new SplendidGrandPiano(context);
    piano.load.catch(() => {});
    expect(typeof piano.start).toBe("function");
    expect(typeof piano.stop).toBe("function");
    expect(piano.output).toBeDefined();
  });

  it("L112: `await new SplendidGrandPiano(context).load` resolves to the instrument", async () => {
    const context = makeContext();
    const piano = await new SplendidGrandPiano(context).load;
    expect(typeof piano.start).toBe("function");
    // Documented one-liner pattern (README §"Load progress / loaded promise")
    const stop = piano.start({ note: "C4", velocity: 50 });
    expect(typeof stop).toBe("function");
  });

  it("L122: `onLoadProgress` callback fires during loading", async () => {
    const context = makeContext();
    const calls: number[] = [];
    await new SplendidGrandPiano(context, {
      onLoadProgress: ({ loaded }) => calls.push(loaded),
    }).load;
    expect(calls.length).toBeGreaterThan(0);
  });

  it("L129: `piano.loadProgress` returns a { loaded, total } object", async () => {
    const context = makeContext();
    const piano = new SplendidGrandPiano(context);
    await piano.load;
    expect(piano.loadProgress).toHaveProperty("loaded");
    expect(piano.loadProgress).toHaveProperty("total");
  });
});
