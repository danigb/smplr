import { RegionMatcher } from "./region-matcher";
import { SmplrGroup, SmplrJson, SmplrRegion } from "./types";

const NO_CC = new Map<number, number>();

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function json(groups: SmplrGroup[]): SmplrJson {
  return { samples: { baseUrl: "", formats: ["ogg"] }, groups };
}

function group(
  regions: SmplrRegion[],
  params: Partial<Omit<SmplrGroup, "regions">> = {}
): SmplrGroup {
  return { regions, ...params };
}

function region(params: Partial<SmplrRegion> & { sample?: string } = {}): SmplrRegion {
  return { sample: "s", ...params };
}

// ---------------------------------------------------------------------------
// Key / velocity matching
// ---------------------------------------------------------------------------

describe("key matching", () => {
  it("region with no keyRange or key matches any MIDI note", () => {
    const matcher = new RegionMatcher(json([group([region()])]));
    expect(matcher.match(0, 64, NO_CC)).toHaveLength(1);
    expect(matcher.match(60, 64, NO_CC)).toHaveLength(1);
    expect(matcher.match(127, 64, NO_CC)).toHaveLength(1);
  });

  it("region.keyRange — inclusive bounds match, outside bounds do not", () => {
    const matcher = new RegionMatcher(
      json([group([region({ keyRange: [48, 72], pitch: 60 })])])
    );
    expect(matcher.match(48, 64, NO_CC)).toHaveLength(1);
    expect(matcher.match(60, 64, NO_CC)).toHaveLength(1);
    expect(matcher.match(72, 64, NO_CC)).toHaveLength(1);
    expect(matcher.match(47, 64, NO_CC)).toHaveLength(0);
    expect(matcher.match(73, 64, NO_CC)).toHaveLength(0);
  });

  it("region.key — shorthand matches only that note", () => {
    const matcher = new RegionMatcher(json([group([region({ key: 60 })])]));
    expect(matcher.match(60, 64, NO_CC)).toHaveLength(1);
    expect(matcher.match(59, 64, NO_CC)).toHaveLength(0);
    expect(matcher.match(61, 64, NO_CC)).toHaveLength(0);
  });

  it("region.key sets pitch in the result", () => {
    const matcher = new RegionMatcher(json([group([region({ key: 60 })])]));
    const [match] = matcher.match(60, 64, NO_CC);
    expect(match.pitch).toBe(60);
  });

  it("group.keyRange filters before region matching", () => {
    const matcher = new RegionMatcher(
      json([group([region()], { keyRange: [48, 72] })])
    );
    expect(matcher.match(60, 64, NO_CC)).toHaveLength(1);
    expect(matcher.match(47, 64, NO_CC)).toHaveLength(0);
    expect(matcher.match(73, 64, NO_CC)).toHaveLength(0);
  });
});

describe("velocity matching", () => {
  it("region with no velRange matches any velocity", () => {
    const matcher = new RegionMatcher(json([group([region()])]));
    expect(matcher.match(60, 1, NO_CC)).toHaveLength(1);
    expect(matcher.match(60, 127, NO_CC)).toHaveLength(1);
  });

  it("region.velRange — inclusive bounds", () => {
    const matcher = new RegionMatcher(
      json([group([region({ velRange: [64, 100] })])])
    );
    expect(matcher.match(60, 64, NO_CC)).toHaveLength(1);
    expect(matcher.match(60, 100, NO_CC)).toHaveLength(1);
    expect(matcher.match(60, 63, NO_CC)).toHaveLength(0);
    expect(matcher.match(60, 101, NO_CC)).toHaveLength(0);
  });

  it("velocity layers — each note returns the correct group", () => {
    const ppp = group([region({ sample: "ppp" })], { velRange: [1, 40] });
    const pp = group([region({ sample: "pp" })], { velRange: [41, 67] });
    const ff = group([region({ sample: "ff" })], { velRange: [68, 127] });
    const matcher = new RegionMatcher(json([ppp, pp, ff]));

    expect(matcher.match(60, 20, NO_CC)[0].sample).toBe("ppp");
    expect(matcher.match(60, 50, NO_CC)[0].sample).toBe("pp");
    expect(matcher.match(60, 100, NO_CC)[0].sample).toBe("ff");
  });

  it("group.velRange filters before region matching", () => {
    const matcher = new RegionMatcher(
      json([group([region()], { velRange: [64, 127] })])
    );
    expect(matcher.match(60, 80, NO_CC)).toHaveLength(1);
    expect(matcher.match(60, 63, NO_CC)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Pitch resolution
// ---------------------------------------------------------------------------

describe("pitch resolution", () => {
  it("region.pitch takes precedence over region.key", () => {
    const r = region({ keyRange: [58, 62], pitch: 60 });
    const matcher = new RegionMatcher(json([group([r])]));
    const [match] = matcher.match(58, 64, NO_CC);
    expect(match.pitch).toBe(60);
  });

  it("falls back to played midi when no pitch or key is set", () => {
    const r = region({ keyRange: [58, 62] });
    const matcher = new RegionMatcher(json([group([r])]));
    const [match] = matcher.match(58, 64, NO_CC);
    expect(match.pitch).toBe(58);
  });
});

// ---------------------------------------------------------------------------
// Round-robin
// ---------------------------------------------------------------------------

describe("round-robin", () => {
  function rrGroup(samples: string[]): SmplrGroup {
    return group(
      samples.map((s, i) => region({ sample: s, seqPosition: i + 1 })),
      { seqLength: samples.length }
    );
  }

  it("cycles through seqPositions in order", () => {
    const matcher = new RegionMatcher(json([rrGroup(["rr1", "rr2", "rr3"])]));
    expect(matcher.match(60, 64, NO_CC)[0].sample).toBe("rr1");
    expect(matcher.match(60, 64, NO_CC)[0].sample).toBe("rr2");
    expect(matcher.match(60, 64, NO_CC)[0].sample).toBe("rr3");
    expect(matcher.match(60, 64, NO_CC)[0].sample).toBe("rr1"); // wraps
  });

  it("returns nothing when no region matches the current seqPosition", () => {
    // seqLength: 2 but only seqPosition 1 defined
    const matcher = new RegionMatcher(
      json([group([region({ sample: "only", seqPosition: 1 })], { seqLength: 2 })])
    );
    expect(matcher.match(60, 64, NO_CC)).toHaveLength(1); // counter=0, pos 0 → match
    expect(matcher.match(60, 64, NO_CC)).toHaveLength(0); // counter=1, pos 1 → no match
  });

  it("per-group counters are independent", () => {
    // Two groups each with seqLength: 2
    const g0 = rrGroup(["g0-rr1", "g0-rr2"]);
    const g1 = rrGroup(["g1-rr1", "g1-rr2"]);
    const matcher = new RegionMatcher(json([g0, g1]));

    // First call: both groups at position 0
    const first = matcher.match(60, 64, NO_CC);
    expect(first.map((m) => m.sample)).toEqual(["g0-rr1", "g1-rr1"]);

    // Second call: both groups at position 1
    const second = matcher.match(60, 64, NO_CC);
    expect(second.map((m) => m.sample)).toEqual(["g0-rr2", "g1-rr2"]);

    // Third call: both wrap to position 0
    const third = matcher.match(60, 64, NO_CC);
    expect(third.map((m) => m.sample)).toEqual(["g0-rr1", "g1-rr1"]);
  });

  it("counter advances even when no region matches the current seqPosition", () => {
    // seqLength: 3; only seqPositions 1 and 3 defined — position 2 returns nothing
    const g = group(
      [
        region({ sample: "rr1", seqPosition: 1 }),
        region({ sample: "rr3", seqPosition: 3 }),
      ],
      { seqLength: 3 }
    );
    const matcher = new RegionMatcher(json([g]));

    expect(matcher.match(60, 64, NO_CC)[0]?.sample).toBe("rr1"); // counter 0
    expect(matcher.match(60, 64, NO_CC)).toHaveLength(0); // counter 1, pos 1 → no match
    expect(matcher.match(60, 64, NO_CC)[0]?.sample).toBe("rr3"); // counter 2
    expect(matcher.match(60, 64, NO_CC)[0]?.sample).toBe("rr1"); // counter 3 → wraps
  });

  it("counter does NOT advance when group does not match (wrong note range)", () => {
    const g = group(
      [
        region({ sample: "rr1", seqPosition: 1 }),
        region({ sample: "rr2", seqPosition: 2 }),
      ],
      { keyRange: [60, 60], seqLength: 2 }
    );
    const matcher = new RegionMatcher(json([g]));

    matcher.match(59, 64, NO_CC); // doesn't match group → counter stays 0
    matcher.match(59, 64, NO_CC); // same

    expect(matcher.match(60, 64, NO_CC)[0].sample).toBe("rr1"); // counter still 0
    expect(matcher.match(60, 64, NO_CC)[0].sample).toBe("rr2"); // counter now 1
  });
});

// ---------------------------------------------------------------------------
// Exclusive groups (group / offBy)
// ---------------------------------------------------------------------------

describe("exclusive groups", () => {
  it("returns offBy from region", () => {
    const r = region({ group: 1, offBy: 2 });
    const matcher = new RegionMatcher(json([group([r])]));
    const [match] = matcher.match(60, 64, NO_CC);
    expect(match.group).toBe(1);
    expect(match.offBy).toBe(2);
  });

  it("returns offBy from group when region does not override", () => {
    const g = group([region({ sample: "s" })], { group: 3, offBy: 3 });
    const matcher = new RegionMatcher(json([g]));
    const [match] = matcher.match(60, 64, NO_CC);
    expect(match.group).toBe(3);
    expect(match.offBy).toBe(3);
  });

  it("region group/offBy takes precedence over group-level values", () => {
    const r = region({ group: 5, offBy: 6 });
    const g = group([r], { group: 1, offBy: 2 });
    const matcher = new RegionMatcher(json([g]));
    const [match] = matcher.match(60, 64, NO_CC);
    expect(match.group).toBe(5);
    expect(match.offBy).toBe(6);
  });

  it("group and offBy are undefined when not set", () => {
    const matcher = new RegionMatcher(json([group([region()])]));
    const [match] = matcher.match(60, 64, NO_CC);
    expect(match.group).toBeUndefined();
    expect(match.offBy).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// CC range
// ---------------------------------------------------------------------------

describe("CC range", () => {
  it("region.ccRange matches when CC value is within range", () => {
    const r = region({ ccRange: { "64": [64, 127] } }); // sustain pedal down
    const matcher = new RegionMatcher(json([group([r])]));

    const withPedal = new Map([[64, 127]]);
    expect(matcher.match(60, 64, withPedal)).toHaveLength(1);
  });

  it("region.ccRange does not match when CC value is out of range", () => {
    const r = region({ ccRange: { "64": [64, 127] } });
    const matcher = new RegionMatcher(json([group([r])]));

    const noPedal = new Map([[64, 0]]);
    expect(matcher.match(60, 64, noPedal)).toHaveLength(0);
  });

  it("unset CC defaults to 0", () => {
    const r = region({ ccRange: { "64": [64, 127] } });
    const matcher = new RegionMatcher(json([group([r])]));
    // No CC in state → defaults to 0, which is outside [64, 127]
    expect(matcher.match(60, 64, NO_CC)).toHaveLength(0);
  });

  it("group.ccRange filters the whole group", () => {
    const g = group([region()], { ccRange: { "64": [64, 127] } });
    const matcher = new RegionMatcher(json([g]));

    expect(matcher.match(60, 64, new Map([[64, 100]]))).toHaveLength(1);
    expect(matcher.match(60, 64, NO_CC)).toHaveLength(0);
  });

  it("multiple CCs must all match", () => {
    const r = region({ ccRange: { "64": [64, 127], "1": [0, 63] } });
    const matcher = new RegionMatcher(json([group([r])]));

    const both = new Map([[64, 127], [1, 50]]);
    expect(matcher.match(60, 64, both)).toHaveLength(1);

    const onlyOne = new Map([[64, 127]]); // CC1 defaults to 0 → in [0,63] → still matches
    expect(matcher.match(60, 64, onlyOne)).toHaveLength(1);

    const fail = new Map([[64, 127], [1, 100]]); // CC1=100 outside [0,63]
    expect(matcher.match(60, 64, fail)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// groupRef / regionRef pass-through
// ---------------------------------------------------------------------------

describe("refs", () => {
  it("groupRef and regionRef reference the original objects", () => {
    const r = region({ key: 60 });
    const g = group([r]);
    const matcher = new RegionMatcher(json([g]));
    const [match] = matcher.match(60, 64, NO_CC);
    expect(match.groupRef).toBe(g);
    expect(match.regionRef).toBe(r);
  });
});
