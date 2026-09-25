import { VoiceManager } from "./voice-manager";

// ---------------------------------------------------------------------------
// Minimal Voice mock — no audio, just the interface VoiceManager needs
// ---------------------------------------------------------------------------

function makeVoice(
  stopId: string | number,
  group?: number,
): {
  stopId: string | number;
  group: number | undefined;
  stop: jest.Mock;
  onEnded: (cb: () => void) => void;
  /** Simulate the Web Audio engine firing onended */
  triggerEnded: () => void;
} {
  let endedCb: (() => void) | undefined;
  return {
    stopId,
    group,
    stop: jest.fn(),
    onEnded(cb: () => void) {
      endedCb = cb;
    },
    triggerEnded() {
      endedCb?.();
    },
  };
}

// ---------------------------------------------------------------------------
// add() and activeCount
// ---------------------------------------------------------------------------

describe("add() / activeCount", () => {
  it("increments activeCount", () => {
    const mgr = new VoiceManager();
    mgr.add(makeVoice("C4") as any);
    expect(mgr.activeCount).toBe(1);
    mgr.add(makeVoice("D4") as any);
    expect(mgr.activeCount).toBe(2);
  });

  it("decrements activeCount when voice fires onEnded", () => {
    const mgr = new VoiceManager();
    const v = makeVoice("C4");
    mgr.add(v as any);
    expect(mgr.activeCount).toBe(1);
    v.triggerEnded();
    expect(mgr.activeCount).toBe(0);
  });

  it("multiple voices with same stopId are all tracked", () => {
    const mgr = new VoiceManager();
    mgr.add(makeVoice("C4") as any);
    mgr.add(makeVoice("C4") as any);
    expect(mgr.activeCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// stopAll()
// ---------------------------------------------------------------------------

describe("stopAll()", () => {
  it("calls stop() on every active voice", () => {
    const mgr = new VoiceManager();
    const v1 = makeVoice("C4");
    const v2 = makeVoice("D4");
    mgr.add(v1 as any);
    mgr.add(v2 as any);

    mgr.stopAll();

    expect(v1.stop).toHaveBeenCalledTimes(1);
    expect(v2.stop).toHaveBeenCalledTimes(1);
  });

  it("passes time to stop()", () => {
    const mgr = new VoiceManager();
    const v = makeVoice("C4");
    mgr.add(v as any);

    mgr.stopAll(1.5);

    expect(v.stop).toHaveBeenCalledWith(1.5);
  });

  it("stops voices added after previous stopAll", () => {
    const mgr = new VoiceManager();
    const v1 = makeVoice("C4");
    mgr.add(v1 as any);
    mgr.stopAll();

    const v2 = makeVoice("D4");
    mgr.add(v2 as any);
    mgr.stopAll();

    expect(v2.stop).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// stopById()
// ---------------------------------------------------------------------------

describe("stopById()", () => {
  it("stops only voices with matching stopId", () => {
    const mgr = new VoiceManager();
    const c4a = makeVoice("C4");
    const c4b = makeVoice("C4");
    const d4 = makeVoice("D4");
    mgr.add(c4a as any);
    mgr.add(c4b as any);
    mgr.add(d4 as any);

    mgr.stopById("C4");

    expect(c4a.stop).toHaveBeenCalledTimes(1);
    expect(c4b.stop).toHaveBeenCalledTimes(1);
    expect(d4.stop).not.toHaveBeenCalled();
  });

  it("passes time to stop()", () => {
    const mgr = new VoiceManager();
    const v = makeVoice(60);
    mgr.add(v as any);

    mgr.stopById(60, 2.0);

    expect(v.stop).toHaveBeenCalledWith(2.0);
  });

  it("does nothing when no voice matches", () => {
    const mgr = new VoiceManager();
    mgr.add(makeVoice("C4") as any);
    // Should not throw
    expect(() => mgr.stopById("E4")).not.toThrow();
  });

  it("works with numeric stopId", () => {
    const mgr = new VoiceManager();
    const v = makeVoice(60);
    mgr.add(v as any);

    mgr.stopById(60);

    expect(v.stop).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// stopGroup()
// ---------------------------------------------------------------------------

describe("stopGroup()", () => {
  it("stops only voices in the specified group", () => {
    const mgr = new VoiceManager();
    const g1a = makeVoice("C4", 1);
    const g1b = makeVoice("D4", 1);
    const g2 = makeVoice("E4", 2);
    const ungrouped = makeVoice("F4", undefined);
    mgr.add(g1a as any);
    mgr.add(g1b as any);
    mgr.add(g2 as any);
    mgr.add(ungrouped as any);

    mgr.stopGroup(1);

    expect(g1a.stop).toHaveBeenCalledTimes(1);
    expect(g1b.stop).toHaveBeenCalledTimes(1);
    expect(g2.stop).not.toHaveBeenCalled();
    expect(ungrouped.stop).not.toHaveBeenCalled();
  });

  it("passes time to stop()", () => {
    const mgr = new VoiceManager();
    const v = makeVoice("C4", 3);
    mgr.add(v as any);

    mgr.stopGroup(3, 0.8);

    expect(v.stop).toHaveBeenCalledWith(0.8);
  });

  it("does nothing when no voice is in the group", () => {
    const mgr = new VoiceManager();
    mgr.add(makeVoice("C4", 1) as any);
    expect(() => mgr.stopGroup(99)).not.toThrow();
  });

  it("voices without a group are not affected", () => {
    const mgr = new VoiceManager();
    const v = makeVoice("C4");
    mgr.add(v as any);

    mgr.stopGroup(1);

    expect(v.stop).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Auto-cleanup after onEnded
// ---------------------------------------------------------------------------

describe("auto-cleanup", () => {
  it("removes voice from stopId index after onEnded", () => {
    const mgr = new VoiceManager();
    const v = makeVoice("C4");
    mgr.add(v as any);
    v.triggerEnded();

    // A subsequent stopById should not call stop() on the ended voice
    mgr.stopById("C4");
    expect(v.stop).not.toHaveBeenCalled();
  });

  it("removes voice from group index after onEnded", () => {
    const mgr = new VoiceManager();
    const v = makeVoice("C4", 1);
    mgr.add(v as any);
    v.triggerEnded();

    mgr.stopGroup(1);
    expect(v.stop).not.toHaveBeenCalled();
  });

  it("does not affect other voices with the same stopId", () => {
    const mgr = new VoiceManager();
    const v1 = makeVoice("C4");
    const v2 = makeVoice("C4");
    mgr.add(v1 as any);
    mgr.add(v2 as any);

    v1.triggerEnded(); // only v1 ends

    mgr.stopById("C4");
    expect(v1.stop).not.toHaveBeenCalled(); // already ended
    expect(v2.stop).toHaveBeenCalledTimes(1); // still active
  });

  it("activeCount reaches 0 after all voices end", () => {
    const mgr = new VoiceManager();
    const v1 = makeVoice("C4");
    const v2 = makeVoice("D4");
    mgr.add(v1 as any);
    mgr.add(v2 as any);

    v1.triggerEnded();
    expect(mgr.activeCount).toBe(1);
    v2.triggerEnded();
    expect(mgr.activeCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// maxVoices
// ---------------------------------------------------------------------------

describe("maxVoices", () => {
  function playing(stopId: string, startTime: number) {
    return { ...makeVoice(stopId), startTime, isPlaying: true };
  }

  it("releases the earliest-started voice at the new voice's start time when over the cap", () => {
    const mgr = new VoiceManager(2);
    const a = playing("a", 1);
    const b = playing("b", 2);
    const c = playing("c", 3);
    mgr.add(a as any);
    mgr.add(b as any);
    mgr.add(c as any);

    expect(a.stop).toHaveBeenCalledWith(3);
    expect(b.stop).not.toHaveBeenCalled();
    expect(c.stop).not.toHaveBeenCalled();
  });

  it("ignores voices that only start after the new voice", () => {
    const mgr = new VoiceManager(1);
    const later = playing("later", 5);
    const earlier = playing("earlier", 2);
    mgr.add(later as any);
    mgr.add(earlier as any);

    expect(later.stop).not.toHaveBeenCalled();
    expect(earlier.stop).not.toHaveBeenCalled(); // never steals the voice being added
  });

  it("picks the earliest start among voices already sounding, not creation order", () => {
    const mgr = new VoiceManager(2);
    const b = playing("b", 2);
    const a = playing("a", 1);
    const c = playing("c", 3);
    mgr.add(b as any);
    mgr.add(a as any);
    mgr.add(c as any);

    expect(a.stop).toHaveBeenCalledWith(3);
    expect(b.stop).not.toHaveBeenCalled();
  });

  it("does not count or steal voices that are already stopping", () => {
    const mgr = new VoiceManager(1);
    const releasing = { ...playing("r", 1), isPlaying: false };
    const next = playing("n", 2);
    mgr.add(releasing as any);
    mgr.add(next as any);

    expect(releasing.stop).not.toHaveBeenCalled();
  });

  it("is unlimited when omitted", () => {
    const mgr = new VoiceManager();
    const voices = Array.from({ length: 200 }, (_, i) => playing(String(i), i));
    voices.forEach((v) => mgr.add(v as any));

    expect(voices.every((v) => v.stop.mock.calls.length === 0)).toBe(true);
  });
});
