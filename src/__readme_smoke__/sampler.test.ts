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
import type { SmplrJson } from "../smplr/types";
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

  it('L622: `sampler.start({ note: "kick" })` accepts buffer-key as note', async () => {
    const buffers = {
      kick: "https://example.test/kick.ogg",
    };
    const sampler = await new Sampler(makeContext(), { buffers }).load;
    expect(() => sampler.start({ note: "kick" })).not.toThrow();
  });

  it("constructs from SmplrJson directly via `{ json }`", async () => {
    const json: SmplrJson = {
      samples: { baseUrl: "https://example.com/", formats: ["ogg"] },
      groups: [
        { regions: [{ sample: "kick", keyRange: [60, 60], pitch: 60 }] },
      ],
    };
    const sampler = await new Sampler(makeContext(), { json }).load;
    const stop = sampler.start({ note: 60 });
    expect(typeof stop).toBe("function");
  });

  it("rejects passing both buffers and json at the type level", () => {
    const ctx = makeContext();
    Sampler(ctx, {
      buffers: { C4: "url" },
      // @ts-expect-error — discriminated union forbids both keys.
      json: {
        samples: { baseUrl: "", formats: ["ogg"] },
        groups: [],
      } as SmplrJson,
    });
  });

  it("reload swaps content via SmplrJson", async () => {
    const kitA: SmplrJson = {
      samples: { baseUrl: "https://example.com/", formats: ["ogg"] },
      groups: [{ regions: [{ sample: "a", keyRange: [60, 60], pitch: 60 }] }],
    };
    const kitB: SmplrJson = {
      samples: { baseUrl: "https://example.com/", formats: ["ogg"] },
      groups: [{ regions: [{ sample: "b", keyRange: [62, 62], pitch: 62 }] }],
    };
    const sampler = await new Sampler(makeContext(), { json: kitA }).load;
    await sampler.reload(kitB);
    const stop = sampler.start({ note: 62 });
    expect(typeof stop).toBe("function");
  });

  it("reload swaps content via flat buffers record", async () => {
    const sampler = await new Sampler(makeContext(), {
      buffers: { C4: "https://example.com/c4.ogg" },
    }).load;
    await sampler.reload({ D4: "https://example.com/d4.ogg" });
    const stop = sampler.start({ note: "D4" });
    expect(typeof stop).toBe("function");
  });

  it("reload during concurrent calls serializes via latest-wins", async () => {
    const kitA: SmplrJson = {
      samples: { baseUrl: "https://example.com/", formats: ["ogg"] },
      groups: [{ regions: [{ sample: "a", keyRange: [60, 60], pitch: 60 }] }],
    };
    const kitB: SmplrJson = {
      samples: { baseUrl: "https://example.com/", formats: ["ogg"] },
      groups: [{ regions: [{ sample: "b", keyRange: [62, 62], pitch: 62 }] }],
    };
    const sampler = await new Sampler(makeContext(), {
      buffers: { C4: "https://example.com/c4.ogg" },
    }).load;
    const p1 = sampler.reload(kitA);
    const p2 = sampler.reload(kitB);
    await Promise.all([p1, p2]);
    expect(typeof sampler.start({ note: 62 })).toBe("function");
  });
});
