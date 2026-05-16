/**
 * README smoke tests — Sampler
 *
 * Covers L609–L616: `new Sampler(ctx, { buffers })` with a URL-keyed buffer
 * map. (L239's `{ duh: "…" }` shorthand is omitted — it's already incorrect
 * syntax in the 0.x README; the canonical documented form is `{ buffers }`.)
 */

jest.mock("../smplr/load-audio", () => ({
  findFirstSupportedFormat: jest.fn().mockReturnValue("ogg"),
  loadAudioBuffer: jest.fn().mockResolvedValue({
    numberOfChannels: 1,
    length: 1,
    sampleRate: 44100,
  }),
}));

import { Sampler } from "../";
import { makeContext } from "./helpers";

describe("README — Sampler", () => {
  it("L616: `new Sampler(ctx, { buffers })` resolves to a playable sampler", async () => {
    const buffers = {
      kick: "https://smpldsnds.github.io/drum-machines/808-mini/kick.m4a",
      snare: "https://smpldsnds.github.io/drum-machines/808-mini/snare-1.m4a",
    };
    const sampler = await new Sampler(makeContext(), { buffers }).load;
    expect(typeof sampler.start).toBe("function");
    expect(typeof sampler.stop).toBe("function");
  });

  it("L622: `sampler.start({ note: \"kick\" })` accepts buffer-key as note", async () => {
    const buffers = {
      kick: "https://example.test/kick.ogg",
    };
    const sampler = await new Sampler(makeContext(), { buffers }).load;
    expect(() => sampler.start({ note: "kick" })).not.toThrow();
  });
});
