/**
 * B5 — `output.setVolume`, `output.sendEffect`, `output.addEffect`,
 * `output.addInsert` continue to be callable on the OutputChannel.
 *
 * The Channel implementation isn't touched in this release — these tests
 * exist as a mechanism-level tripwire so a future refactor can't silently
 * remove or rename one of them without lighting up here first.
 */
import { SplendidGrandPiano } from "../splendid-grand-piano";
import { createAudioContextMock } from "../test-helpers";

// Stub the audio fetch/decode so constructing an instrument doesn't fire real
// network requests to the sample CDN (which leave the jest worker hanging).
jest.mock("../smplr/load-audio", () => ({
  findFirstSupportedFormat: jest.fn().mockReturnValue("ogg"),
  loadAudioBuffer: jest.fn().mockResolvedValue(undefined),
}));

describe("B5 — output channel aliases stay callable", () => {
  it("output exposes setVolume, sendEffect, addEffect, addInsert", () => {
    const ctx = createAudioContextMock();
    const piano = new SplendidGrandPiano(ctx as any);
    piano.load.catch(() => {});

    expect(typeof piano.output.setVolume).toBe("function");
    expect(typeof piano.output.sendEffect).toBe("function");
    expect(typeof piano.output.addEffect).toBe("function");
    expect(typeof piano.output.addInsert).toBe("function");
  });

  it("setVolume accepts a number without throwing", () => {
    const ctx = createAudioContextMock();
    const piano = new SplendidGrandPiano(ctx as any);
    piano.load.catch(() => {});

    expect(() => piano.output.setVolume(80)).not.toThrow();
  });

  it("output.volume getter returns the latest set value", () => {
    const ctx = createAudioContextMock();
    const piano = new SplendidGrandPiano(ctx as any);
    piano.load.catch(() => {});

    piano.output.volume = 80;
    expect(piano.output.volume).toBe(80);
  });

  it("output.setEffectMix is a function", () => {
    const ctx = createAudioContextMock();
    const piano = new SplendidGrandPiano(ctx as any);
    piano.load.catch(() => {});

    expect(typeof piano.output.setEffectMix).toBe("function");
  });

  it("setVolume and volume setter are equivalent", () => {
    const ctx = createAudioContextMock();
    const a = new SplendidGrandPiano(ctx as any);
    a.load.catch(() => {});
    a.output.setVolume(60);

    const b = new SplendidGrandPiano(ctx as any);
    b.load.catch(() => {});
    b.output.volume = 60;

    expect(a.output.volume).toBe(b.output.volume);
  });
});
