import { parseTicks } from "./time-parser";

// Default test context: ppq=96, timeSignature=4 (4/4)
const PPQ = 96;
const TS = 4;

function pt(time: string | number) {
  return parseTicks(time, PPQ, TS);
}

// ---------------------------------------------------------------------------
// Number passthrough
// ---------------------------------------------------------------------------

describe("number passthrough", () => {
  it("returns a number directly", () => {
    expect(pt(0)).toBe(0);
    expect(pt(96)).toBe(96);
    expect(pt(384)).toBe(384);
    expect(pt(1.5)).toBe(1.5);
  });

  it("parses a bare number string", () => {
    expect(pt("0")).toBe(0);
    expect(pt("96")).toBe(96);
    expect(pt("384")).toBe(384);
    expect(pt("48.5")).toBe(48.5);
  });
});

// ---------------------------------------------------------------------------
// Note values
// ---------------------------------------------------------------------------

describe("note values", () => {
  it("whole note: 1n = 4 * ppq", () => {
    expect(pt("1n")).toBe(4 * PPQ); // 384
  });

  it("half note: 2n = 2 * ppq", () => {
    expect(pt("2n")).toBe(2 * PPQ); // 192
  });

  it("quarter note: 4n = ppq", () => {
    expect(pt("4n")).toBe(PPQ); // 96
  });

  it("eighth note: 8n = ppq / 2", () => {
    expect(pt("8n")).toBe(PPQ / 2); // 48
  });

  it("sixteenth note: 16n = ppq / 4", () => {
    expect(pt("16n")).toBe(PPQ / 4); // 24
  });

  it("thirty-second note: 32n = ppq / 8", () => {
    expect(pt("32n")).toBe(PPQ / 8); // 12
  });
});

// ---------------------------------------------------------------------------
// Dotted notes
// ---------------------------------------------------------------------------

describe("dotted notes", () => {
  it("dotted quarter: 4n. = ppq * 1.5", () => {
    expect(pt("4n.")).toBe(PPQ * 1.5); // 144
  });

  it("dotted eighth: 8n. = ppq * 0.75", () => {
    expect(pt("8n.")).toBe(PPQ * 0.75); // 72
  });

  it("dotted half: 2n. = ppq * 3", () => {
    expect(pt("2n.")).toBe(PPQ * 3); // 288
  });
});

// ---------------------------------------------------------------------------
// Measures
// ---------------------------------------------------------------------------

describe("measures", () => {
  it("1m = ppq * timeSignature", () => {
    expect(pt("1m")).toBe(PPQ * TS); // 384
  });

  it("2m = 2 * ppq * timeSignature", () => {
    expect(pt("2m")).toBe(2 * PPQ * TS); // 768
  });

  it("0.5m = half a measure", () => {
    expect(pt("0.5m")).toBe(0.5 * PPQ * TS); // 192
  });
});

// ---------------------------------------------------------------------------
// Measures in 3/4 time
// ---------------------------------------------------------------------------

describe("measures in 3/4", () => {
  it("1m in 3/4 = ppq * 3", () => {
    expect(parseTicks("1m", PPQ, 3)).toBe(PPQ * 3); // 288
  });
});

// ---------------------------------------------------------------------------
// Position: bar:beat (1-indexed)
// ---------------------------------------------------------------------------

describe("position bar:beat", () => {
  it("1:1 = 0 ticks (very beginning)", () => {
    expect(pt("1:1")).toBe(0);
  });

  it("1:2 = ppq ticks (beat 2 of bar 1)", () => {
    expect(pt("1:2")).toBe(PPQ); // 96
  });

  it("1:3 = 2 * ppq (beat 3 of bar 1)", () => {
    expect(pt("1:3")).toBe(2 * PPQ); // 192
  });

  it("2:1 = one full measure in (bar 2, beat 1)", () => {
    expect(pt("2:1")).toBe(PPQ * TS); // 384
  });

  it("2:3 = bar 2 + 2 beats", () => {
    expect(pt("2:3")).toBe(PPQ * TS + 2 * PPQ); // 384 + 192 = 576
  });

  it("3:1 = two full measures in", () => {
    expect(pt("3:1")).toBe(2 * PPQ * TS); // 768
  });
});

// ---------------------------------------------------------------------------
// Position: bar:beat:tick
// ---------------------------------------------------------------------------

describe("position bar:beat:tick", () => {
  it("1:1:0 = 0 ticks", () => {
    expect(pt("1:1:0")).toBe(0);
  });

  it("1:1:48 = 48 raw ticks", () => {
    expect(pt("1:1:48")).toBe(48);
  });

  it("2:1:0 = one measure", () => {
    expect(pt("2:1:0")).toBe(PPQ * TS); // 384
  });

  it("2:3:48 = bar2 + 2 beats + 48 ticks", () => {
    expect(pt("2:3:48")).toBe(PPQ * TS + 2 * PPQ + 48); // 384 + 192 + 48 = 624
  });
});

// ---------------------------------------------------------------------------
// Fractional beats
// ---------------------------------------------------------------------------

describe("fractional beats", () => {
  it("1:1.5 = half a beat in (eighth note position)", () => {
    expect(pt("1:1.5")).toBe(PPQ * 0.5); // 48
  });

  it("2:2.5 = bar 2, beat 2.5", () => {
    expect(pt("2:2.5")).toBe(PPQ * TS + PPQ * 1.5); // 384 + 144 = 528
  });
});

// ---------------------------------------------------------------------------
// Custom ppq
// ---------------------------------------------------------------------------

describe("custom ppq", () => {
  it("4n at ppq=480 = 480 ticks", () => {
    expect(parseTicks("4n", 480, 4)).toBe(480);
  });

  it("1m at ppq=24, ts=4 = 96 ticks", () => {
    expect(parseTicks("1m", 24, 4)).toBe(96);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("throws for unrecognized format", () => {
    expect(() => pt("foo")).toThrow('parseTicks: cannot parse "foo"');
  });

  it("throws for incomplete notation", () => {
    expect(() => pt("n")).toThrow();
  });
});
