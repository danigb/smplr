/**
 * B1 — every first-party factory accepts both `new X(ctx, opts)` and
 * `X(ctx, opts)` and produces an instance with the documented surface.
 *
 * Defends the dual call/construct signature on `InstrumentFactory<O, E>`.
 */
import {
  Sampler,
  SplendidGrandPiano,
  Soundfont,
  DrumMachine,
  ElectricPiano,
  Mallet,
  Mellotron,
  Smolken,
  Versilian,
  Soundfont2Sampler,
} from "..";
import { createAudioContextMock } from "../test-helpers";

function silentFetch() {
  (global as any).fetch = jest.fn().mockResolvedValue({
    status: 200,
    text: async () => "",
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0),
  });
}

function swallow(promise: Promise<unknown> | undefined) {
  if (promise && typeof promise.catch === "function") {
    promise.catch(() => {
      /* tests don't drive the load to completion */
    });
  }
}

describe("B1 — dual call/construct signature", () => {
  beforeEach(silentFetch);

  it("Sampler accepts `new` and call forms", () => {
    const ctx = createAudioContextMock();
    const viaNew = new Sampler(ctx as any, {});
    const viaCall = Sampler(ctx as any, {});
    swallow(viaNew.load);
    swallow(viaCall.load);
    expect(typeof viaNew.start).toBe("function");
    expect(typeof viaCall.start).toBe("function");
  });

  it("SplendidGrandPiano accepts `new` and call forms", () => {
    const ctx = createAudioContextMock();
    const viaNew = new SplendidGrandPiano(ctx as any);
    const viaCall = SplendidGrandPiano(ctx as any);
    swallow(viaNew.load);
    swallow(viaCall.load);
    expect(typeof viaNew.start).toBe("function");
    expect(typeof viaCall.start).toBe("function");
  });

  it("Soundfont accepts `new` and call forms", () => {
    const ctx = createAudioContextMock();
    const viaNew = new Soundfont(ctx as any, { instrument: "acoustic_grand_piano" });
    const viaCall = Soundfont(ctx as any, { instrument: "acoustic_grand_piano" });
    swallow(viaNew.load);
    swallow(viaCall.load);
    expect(typeof viaNew.start).toBe("function");
    expect(typeof viaCall.start).toBe("function");
  });

  it("DrumMachine accepts `new` and call forms", () => {
    const ctx = createAudioContextMock();
    const viaNew = new DrumMachine(ctx as any);
    const viaCall = DrumMachine(ctx as any);
    swallow(viaNew.load);
    swallow(viaCall.load);
    expect(typeof viaNew.start).toBe("function");
    expect(typeof viaCall.start).toBe("function");
    // CD-3: DrumMachine's `start` is an extras-level override, so it sits as an
    // own property on the instance rather than being inherited.
    expect(Object.prototype.hasOwnProperty.call(viaNew, "start")).toBe(true);
  });

  it("ElectricPiano accepts `new` and call forms", () => {
    const ctx = createAudioContextMock();
    const viaNew = new ElectricPiano(ctx as any, { instrument: "CP80" });
    const viaCall = ElectricPiano(ctx as any, { instrument: "CP80" });
    swallow(viaNew.load);
    swallow(viaCall.load);
    expect(typeof viaNew.start).toBe("function");
    expect(typeof viaCall.start).toBe("function");
    // sync extra available immediately, before load resolves
    expect(typeof viaNew.tremolo.level).toBe("function");
  });

  it("Mallet accepts `new` and call forms", () => {
    const ctx = createAudioContextMock();
    const viaNew = new Mallet(ctx as any);
    const viaCall = Mallet(ctx as any);
    swallow(viaNew.load);
    swallow(viaCall.load);
    expect(typeof viaNew.start).toBe("function");
    expect(typeof viaCall.start).toBe("function");
  });

  it("Mellotron accepts `new` and call forms", () => {
    const ctx = createAudioContextMock();
    const viaNew = new Mellotron(ctx as any);
    const viaCall = Mellotron(ctx as any);
    swallow(viaNew.load);
    swallow(viaCall.load);
    expect(typeof viaNew.start).toBe("function");
    expect(typeof viaCall.start).toBe("function");
  });

  it("Smolken accepts `new` and call forms", () => {
    const ctx = createAudioContextMock();
    const viaNew = new Smolken(ctx as any);
    const viaCall = Smolken(ctx as any);
    swallow(viaNew.load);
    swallow(viaCall.load);
    expect(typeof viaNew.start).toBe("function");
    expect(typeof viaCall.start).toBe("function");
  });

  it("Versilian accepts `new` and call forms", () => {
    const ctx = createAudioContextMock();
    const viaNew = new Versilian(ctx as any);
    const viaCall = Versilian(ctx as any);
    swallow(viaNew.load);
    swallow(viaCall.load);
    expect(typeof viaNew.start).toBe("function");
    expect(typeof viaCall.start).toBe("function");
  });

  it("Soundfont2Sampler accepts `new` and call forms", () => {
    const ctx = createAudioContextMock();
    const opts = {
      url: "http://example.test/empty.sf2",
      createSoundfont: () => ({ instruments: [] }),
    };
    const viaNew = new Soundfont2Sampler(ctx as any, opts);
    const viaCall = Soundfont2Sampler(ctx as any, opts);
    swallow(viaNew.load);
    swallow(viaCall.load);
    expect(typeof viaNew.start).toBe("function");
    expect(typeof viaCall.start).toBe("function");
    // sync extra surfaces immediately
    expect(Array.isArray(viaNew.instrumentNames)).toBe(true);
    expect(typeof viaNew.loadInstrument).toBe("function");
  });
});
