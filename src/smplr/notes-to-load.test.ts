import { filterPreset, findNearestKey } from "./notes-to-load";
import { SmplrPreset } from "./types";

/** Three regions keyed to C4, D4 (60-62) and E4, plus a drum-style alias. */
function makePreset(overrides?: Partial<SmplrPreset>): SmplrPreset {
  return {
    samples: { baseUrl: "", formats: ["ogg"] },
    groups: [
      {
        regions: [
          { sample: "c4", key: 60 },
          { sample: "d4", keyRange: [61, 62], pitch: 62 },
          { sample: "e4", key: 64 },
        ],
      },
    ],
    aliases: { kick: 64 },
    ...overrides,
  };
}

function samples(preset: SmplrPreset): string[] {
  return preset.groups.flatMap((g) => g.regions.map((r) => r.sample));
}

describe("filterPreset", () => {
  it("returns the same preset when notesToLoad is undefined or empty", () => {
    const preset = makePreset();
    for (const notesToLoad of [
      undefined,
      {},
      { fallback: "nearest" as const },
    ]) {
      const result = filterPreset(preset, notesToLoad);
      expect(result.preset).toBe(preset);
      expect(result.filtered).toBe(false);
      expect(result.unresolved).toEqual([]);
    }
  });

  it("keeps regions covering the requested MIDI numbers", () => {
    const { preset } = filterPreset(makePreset(), { notes: [61] });
    expect(samples(preset)).toEqual(["d4"]);
  });

  it("resolves note names and preset aliases", () => {
    const { preset } = filterPreset(makePreset(), { notes: ["C4", "kick"] });
    expect(samples(preset)).toEqual(["c4", "e4"]);
  });

  it("loads nothing when notes is empty", () => {
    const { preset, filtered } = filterPreset(makePreset(), { notes: [] });
    expect(preset.groups).toEqual([]);
    expect(filtered).toBe(true);
  });

  it("does not mutate the input preset", () => {
    const input = makePreset();
    const copy = JSON.parse(JSON.stringify(input));
    filterPreset(input, { notes: [60] });
    expect(input).toEqual(copy);
  });

  it("reports entries that match nothing and ignores them", () => {
    const { preset, unresolved } = filterPreset(makePreset(), {
      notes: ["C4", "kik", "C#44", 200, 60.5],
    });
    expect(samples(preset)).toEqual(["c4"]);
    expect(unresolved).toEqual(["kik", "C#44", 200, 60.5]);
  });

  it("keeps a region without key constraints when any note is requested", () => {
    const preset = makePreset({
      groups: [{ regions: [{ sample: "any" }] }],
    });
    expect(samples(filterPreset(preset, { notes: [10] }).preset)).toEqual([
      "any",
    ]);
    expect(filterPreset(preset, { notes: [] }).preset.groups).toEqual([]);
  });

  it("intersects region key ranges with the group key range", () => {
    const preset = makePreset({
      groups: [
        { keyRange: [0, 60], regions: [{ sample: "low" }] },
        { keyRange: [61, 127], regions: [{ sample: "high" }] },
      ],
    });
    expect(samples(filterPreset(preset, { notes: [72] }).preset)).toEqual([
      "high",
    ]);
  });

  describe("velocityRange", () => {
    const layered = makePreset({
      groups: [
        { velRange: [1, 63], regions: [{ sample: "soft", key: 60 }] },
        { velRange: [64, 127], regions: [{ sample: "loud", key: 60 }] },
        {
          regions: [
            { sample: "region-soft", key: 60, velRange: [1, 40] },
            { sample: "region-loud", key: 60, velRange: [100, 127] },
          ],
        },
      ],
    });

    it("keeps groups and regions whose velocity range overlaps", () => {
      const { preset } = filterPreset(layered, { velocityRange: [90, 110] });
      expect(samples(preset)).toEqual(["loud", "region-loud"]);
    });

    it("combines with notes", () => {
      const { preset } = filterPreset(layered, {
        notes: [61],
        velocityRange: [90, 110],
      });
      expect(preset.groups).toEqual([]);
    });
  });
});

describe("findNearestKey", () => {
  const playable =
    (...keys: number[]) =>
    (key: number) =>
      keys.includes(key);

  it("finds the nearest playable key in either direction", () => {
    expect(findNearestKey(62, playable(60, 70))).toBe(60);
    expect(findNearestKey(68, playable(60, 70))).toBe(70);
  });

  it("prefers the lower key on ties", () => {
    expect(findNearestKey(65, playable(60, 70))).toBe(60);
  });

  it("only checks keys 0–127", () => {
    const checked: number[] = [];
    findNearestKey(126, (key) => {
      checked.push(key);
      return false;
    });
    expect(Math.min(...checked)).toBe(0);
    expect(Math.max(...checked)).toBe(127);
  });

  it("works at the edges of the keyboard", () => {
    expect(findNearestKey(0, playable(127))).toBe(127);
    expect(findNearestKey(127, playable(0))).toBe(0);
  });

  it("returns undefined when nothing is playable", () => {
    expect(findNearestKey(60, playable())).toBeUndefined();
  });
});
