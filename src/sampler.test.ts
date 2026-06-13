/**
 * Sampler — construction and reload behavior.
 *
 * (Rescued from the former README smoke harness: these are the only tests that
 * cover Sampler's `{ buffers }` / `{ preset }` construction and reload semantics.)
 */

jest.mock("./smplr/load-audio", () => ({
  findFirstSupportedFormat: jest.fn().mockReturnValue("ogg"),
  loadAudioBuffer: jest.fn().mockResolvedValue({
    numberOfChannels: 1,
    length: 1,
    sampleRate: 44100,
  }),
}));

import { Sampler } from "./sampler";
import type { SmplrPreset } from "./smplr/types";
import { createAudioContextMock } from "./test-helpers";

function makeContext(): AudioContext {
  return createAudioContextMock().context;
}

describe("Sampler", () => {
  it("constructs from a URL-keyed `{ buffers }` map and is playable", async () => {
    const buffers = {
      kick: "https://smpldsnds.github.io/drum-machines/808-mini/kick.m4a",
      snare: "https://smpldsnds.github.io/drum-machines/808-mini/snare-1.m4a",
    };
    const sampler = Sampler(makeContext(), { buffers });
    await sampler.ready;
    expect(typeof sampler.start).toBe("function");
    expect(typeof sampler.stop).toBe("function");
  });

  it("accepts a buffer key as the note in `start()`", async () => {
    const buffers = {
      kick: "https://example.test/kick.ogg",
    };
    const sampler = Sampler(makeContext(), { buffers });
    await sampler.ready;
    expect(() => sampler.start({ note: "kick" })).not.toThrow();
  });

  it("constructs from a SmplrPreset via `{ preset }`", async () => {
    const preset: SmplrPreset = {
      samples: { baseUrl: "https://example.com/", formats: ["ogg"] },
      groups: [
        { regions: [{ sample: "kick", keyRange: [60, 60], pitch: 60 }] },
      ],
    };
    const sampler = Sampler(makeContext(), { preset });
    await sampler.ready;
    const stop = sampler.start({ note: 60 });
    expect(typeof stop).toBe("function");
  });

  it("rejects passing both `buffers` and `preset` at the type level", () => {
    const ctx = makeContext();
    Sampler(ctx, {
      buffers: { C4: "url" },
      // @ts-expect-error — discriminated union forbids both keys.
      preset: {
        samples: { baseUrl: "", formats: ["ogg"] },
        groups: [],
      } as SmplrPreset,
    });
  });

  it("reload swaps content via SmplrPreset", async () => {
    const kitA: SmplrPreset = {
      samples: { baseUrl: "https://example.com/", formats: ["ogg"] },
      groups: [{ regions: [{ sample: "a", keyRange: [60, 60], pitch: 60 }] }],
    };
    const kitB: SmplrPreset = {
      samples: { baseUrl: "https://example.com/", formats: ["ogg"] },
      groups: [{ regions: [{ sample: "b", keyRange: [62, 62], pitch: 62 }] }],
    };
    const sampler = Sampler(makeContext(), { preset: kitA });
    await sampler.ready;
    await sampler.reload(kitB);
    const stop = sampler.start({ note: 62 });
    expect(typeof stop).toBe("function");
  });

  it("reload swaps content via a flat buffers record", async () => {
    const sampler = Sampler(makeContext(), {
      buffers: { C4: "https://example.com/c4.ogg" },
    });
    await sampler.ready;
    await sampler.reload({ D4: "https://example.com/d4.ogg" });
    const stop = sampler.start({ note: "D4" });
    expect(typeof stop).toBe("function");
  });

  it("serializes concurrent reload calls via latest-wins", async () => {
    const kitA: SmplrPreset = {
      samples: { baseUrl: "https://example.com/", formats: ["ogg"] },
      groups: [{ regions: [{ sample: "a", keyRange: [60, 60], pitch: 60 }] }],
    };
    const kitB: SmplrPreset = {
      samples: { baseUrl: "https://example.com/", formats: ["ogg"] },
      groups: [{ regions: [{ sample: "b", keyRange: [62, 62], pitch: 62 }] }],
    };
    const sampler = Sampler(makeContext(), {
      buffers: { C4: "https://example.com/c4.ogg" },
    });
    await sampler.ready;
    const p1 = sampler.reload(kitA);
    const p2 = sampler.reload(kitB);
    await Promise.all([p1, p2]);
    expect(typeof sampler.start({ note: 62 })).toBe("function");
  });
});
