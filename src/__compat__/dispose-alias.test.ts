/**
 * B6 — `dispose()` is the canonical teardown; `disconnect()` remains a
 * deprecated runtime alias.
 *
 * Also asserts the post-dispose guards: calling mutating methods after
 * dispose() throws a clear error.
 */
import { SplendidGrandPiano } from "../splendid-grand-piano";
import { createAudioContextMock } from "../test-helpers";

// Stub the audio fetch/decode so constructing an instrument doesn't fire real
// network requests to the sample CDN (which leave the jest worker hanging).
jest.mock("../smplr/load-audio", () => ({
  findFirstSupportedFormat: jest.fn().mockReturnValue("ogg"),
  loadAudioBuffer: jest.fn().mockResolvedValue(undefined),
}));

describe("B6 — dispose() and disconnect() both work", () => {
  it("dispose() is callable and idempotent", () => {
    const ctx = createAudioContextMock();
    const piano = new SplendidGrandPiano(ctx as any);
    piano.load.catch(() => {});

    expect(() => piano.dispose()).not.toThrow();
    expect(() => piano.dispose()).not.toThrow();
  });

  it("disconnect() still works as a deprecated alias", () => {
    const ctx = createAudioContextMock();
    const piano = new SplendidGrandPiano(ctx as any);
    piano.load.catch(() => {});

    expect(() => piano.disconnect()).not.toThrow();
  });

  it("disconnect() and dispose() delegate to the same teardown", () => {
    const ctx = createAudioContextMock();
    const piano = new SplendidGrandPiano(ctx as any);
    piano.load.catch(() => {});

    piano.disconnect();
    expect(() => piano.dispose()).not.toThrow();
  });

  it("start() throws after dispose()", () => {
    const ctx = createAudioContextMock();
    const piano = new SplendidGrandPiano(ctx as any);
    piano.load.catch(() => {});

    piano.dispose();
    expect(() => piano.start({ note: "C4" })).toThrow(/disposed/);
  });

  it("setCC() throws after dispose()", () => {
    const ctx = createAudioContextMock();
    const piano = new SplendidGrandPiano(ctx as any);
    piano.load.catch(() => {});

    piano.dispose();
    expect(() => piano.setCC(64, 127)).toThrow(/disposed/);
  });

  it("getCC() throws after dispose()", () => {
    const ctx = createAudioContextMock();
    const piano = new SplendidGrandPiano(ctx as any);
    piano.load.catch(() => {});

    piano.dispose();
    expect(() => piano.getCC(64)).toThrow(/disposed/);
  });

  it("getCC() returns 0 for unset CC before dispose", () => {
    const ctx = createAudioContextMock();
    const piano = new SplendidGrandPiano(ctx as any);
    piano.load.catch(() => {});

    expect(piano.getCC(64)).toBe(0);
    piano.setCC(64, 100);
    expect(piano.getCC(64)).toBe(100);
  });
});
