/**
 * B2, B3, B10 — the deprecated `load` getter resolves to the instrument and
 * supports the `.load.then(cb)` callback form. Covers Pattern A→B migration
 * for SplendidGrandPiano (B3) and the extras-bearing case (DrumMachine, B8).
 */
import { DrumMachine } from "../drum-machine/drum-machine";
import { SplendidGrandPiano } from "../splendid-grand-piano";
import { Sampler } from "../sampler";
import { createAudioContextMock, createFetchMock } from "../test-helpers";

jest.mock("../smplr/load-audio", () => ({
  findFirstSupportedFormat: jest.fn().mockReturnValue("ogg"),
  loadAudioBuffer: jest.fn().mockResolvedValue({
    numberOfChannels: 1,
    length: 1,
    sampleRate: 44100,
  }),
}));

describe("B2, B3, B10 — `load` getter compat", () => {
  it("await new SplendidGrandPiano(ctx).load resolves to the instrument (Pattern A→B)", async () => {
    const ctx = createAudioContextMock();
    const piano = await new SplendidGrandPiano(ctx as any).load;
    expect(typeof piano.start).toBe("function");
    expect(typeof piano.stop).toBe("function");
  });

  it(".load.then(cb) runs cb with the instrument (B10)", async () => {
    const ctx = createAudioContextMock();
    const sampler = new Sampler(ctx as any, {});
    const cb = jest.fn();
    await sampler.load.then(cb);
    expect(cb).toHaveBeenCalledWith(sampler);
  });

  it("DrumMachine load resolves with extras still bound to the instance", async () => {
    createFetchMock({
      "https://smpldsnds.github.io/drum-machines/TR-808/dm.json": {
        baseUrl: "",
        name: "",
        samples: ["kick/low"],
      },
      "https://smpldsnds.github.io/drum-machines/TR-808/kick/low.ogg": "kick",
    });
    const ctx = createAudioContextMock();
    const drums = await new DrumMachine(ctx.context, { instrument: "TR-808" })
      .load;
    expect(typeof drums.start).toBe("function");
    // extras populated after load
    expect(drums.getSampleNames()).toEqual(["kick/low"]);
    expect(drums.getGroupNames()).toEqual(["kick"]);
  });

  it("ready and load resolve at the same observable point", async () => {
    const ctx = createAudioContextMock();
    const piano = new SplendidGrandPiano(ctx as any);
    const order: string[] = [];
    piano.ready.then(() => order.push("ready"));
    piano.load.then(() => order.push("load"));
    await piano.load;
    expect(order).toEqual(["ready", "load"]);
  });
});
