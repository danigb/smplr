import { Voice } from "./voice";
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
  steal: jest.Mock;
  onEnded: (cb: () => void) => void;
  /** Simulate the Web Audio engine firing onended */
  triggerEnded: () => void;
} {
  let endedCb: (() => void) | undefined;
  return {
    stopId,
    group,
    stop: jest.fn(),
    steal: jest.fn(),
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
  /** A voice sounding from `startTime` until `endTime` (Infinity = until stopped). */
  function playing(stopId: string, startTime: number, endTime = Infinity) {
    return {
      ...makeVoice(stopId),
      startTime,
      endTime,
      isReleasing: endTime !== Infinity,
    };
  }

  it("releases the earliest-started voice at the new voice's start time when over the cap", () => {
    const mgr = new VoiceManager(2);
    const a = playing("a", 1);
    const b = playing("b", 2);
    const c = playing("c", 3);
    mgr.add(a as any);
    mgr.add(b as any);
    mgr.add(c as any);

    expect(a.steal).toHaveBeenCalledWith(3);
    expect(b.steal).not.toHaveBeenCalled();
    expect(c.steal).not.toHaveBeenCalled();
  });

  it("cancels the newest voices when several start at the same time (a chord)", () => {
    const mgr = new VoiceManager(2);
    const chord = [60, 64, 67, 72].map((n) => playing(String(n), 1));
    chord.forEach((v) => mgr.add(v as any));

    expect(chord[0].steal).not.toHaveBeenCalled();
    expect(chord[1].steal).not.toHaveBeenCalled();
    expect(chord[2].steal).toHaveBeenCalledWith(1);
    expect(chord[3].steal).toHaveBeenCalledWith(1);
  });

  it("never releases the voice being added at its own start time", () => {
    const mgr = new VoiceManager(1);
    const earlier = playing("earlier", 2);
    mgr.add(earlier as any);
    const later = playing("later", 3);
    mgr.add(later as any);

    expect(earlier.steal).toHaveBeenCalledWith(3);
    expect(later.steal).not.toHaveBeenCalled();
  });

  it("picks the earliest start among voices already sounding, not creation order", () => {
    const mgr = new VoiceManager(2);
    const b = playing("b", 2);
    const a = playing("a", 1);
    const c = playing("c", 3);
    mgr.add(b as any);
    mgr.add(a as any);
    mgr.add(c as any);

    expect(a.steal).toHaveBeenCalledWith(3);
    expect(b.steal).not.toHaveBeenCalled();
  });

  it("counts notes with a duration (a stop already scheduled) while they are still audible", () => {
    const mgr = new VoiceManager(2);
    // sequencer: three notes scheduled ahead, each lasting 4s - all three overlap at t=2
    const a = playing("a", 0, 4.5);
    const b = playing("b", 1, 5.5);
    const c = playing("c", 2, 6.5);
    mgr.add(a as any);
    mgr.add(b as any);
    mgr.add(c as any);

    expect(a.steal).toHaveBeenCalledWith(2);
  });

  it("counts voices that are releasing but still audible when the new one starts", () => {
    const mgr = new VoiceManager(1);
    const releasing = playing("r", 1, 3);
    const next = playing("n", 2);
    mgr.add(releasing as any);
    mgr.add(next as any);

    expect(releasing.steal).toHaveBeenCalledWith(2);
  });

  it("doesn't count voices that have finished before the new one starts", () => {
    const mgr = new VoiceManager(1);
    const done = playing("done", 0, 1.5);
    const next = playing("next", 2);
    mgr.add(done as any);
    mgr.add(next as any);

    expect(done.steal).not.toHaveBeenCalled();
  });

  it("can release several voices when one added voice overlaps more than one start", () => {
    const mgr = new VoiceManager(1);
    const p = playing("p", 10);
    const q = playing("q", 11);
    mgr.add(p as any);
    mgr.add(q as any); // releases p at 11
    p.steal.mockClear();

    // starts first and stays open: sounds with p at 10 and (the mock doesn't end p) with q at 11
    const r = playing("r", 1);
    mgr.add(r as any);

    expect(r.steal).toHaveBeenCalledWith(10);
    expect(p.steal).toHaveBeenCalledWith(11);
    expect(q.steal).not.toHaveBeenCalled();
  });

  it("prefers voices that are already releasing", () => {
    const mgr = new VoiceManager(2);
    const old = playing("old", 0);
    const releasing = playing("releasing", 1, 6);
    mgr.add(old as any);
    mgr.add(releasing as any);

    mgr.add(playing("new", 3) as any);

    expect(releasing.steal).toHaveBeenCalledWith(3);
    expect(old.steal).not.toHaveBeenCalled();
  });

  it("limits voices added out of order: the older voice is released when the later one starts", () => {
    const mgr = new VoiceManager(1);
    const later = playing("later", 5);
    const earlier = playing("earlier", 1);
    mgr.add(later as any);
    mgr.add(earlier as any); // starts first, still sounding when `later` starts

    expect(earlier.steal).toHaveBeenCalledWith(5);
    expect(later.steal).not.toHaveBeenCalled();
  });

  it("doesn't look at the voices at all when there is no cap", () => {
    const mgr = new VoiceManager();
    const spy = jest.fn(() => 0);
    const voice = { ...makeVoice("a"), startTime: 0, isReleasing: false };
    Object.defineProperty(voice, "endTime", { get: spy });

    mgr.add(voice as any);

    expect(spy).not.toHaveBeenCalled();
  });

  it("is unlimited when omitted", () => {
    const mgr = new VoiceManager();
    const voices = Array.from({ length: 200 }, (_, i) => playing(String(i), i));
    voices.forEach((v) => mgr.add(v as any));

    expect(voices.every((v) => v.stop.mock.calls.length === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// maxVoices with real Voice objects
//
// The mocks above fake stop() without touching endTime, so they can't show whether
// stopping a voice really shortens it. These use the real Voice.
// ---------------------------------------------------------------------------

describe("maxVoices with real voices", () => {
  const param = () => ({
    value: 1,
    cancelScheduledValues: jest.fn(),
    setValueAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
  });
  const node = () => ({ connect: jest.fn(), disconnect: jest.fn() });

  /** Just enough of an AudioContext for Voice: nothing is rendered. */
  const context = {
    currentTime: 0,
    createBufferSource: () => ({
      ...node(),
      detune: param(),
      playbackRate: param(),
      start: jest.fn(),
      stop: jest.fn(),
    }),
    createGain: () => ({ ...node(), gain: param() }),
  } as unknown as BaseAudioContext;
  const buffer = { duration: 10 } as AudioBuffer;
  const destination = {} as AudioNode;

  function setup(maxVoices: number, ampRelease: number) {
    const manager = new VoiceManager(maxVoices);
    const voices: Voice[] = [];
    const params = {
      detune: 0,
      velocity: 100,
      volume: 0,
      ampRelease,
      ampAttack: 0,
      lpfCutoffHz: 20000,
      offset: 0,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
    };
    return {
      voices,
      add(startTime: number, stopAt?: number) {
        const voice = new Voice(
          context,
          buffer,
          params,
          destination,
          `n${voices.length}`,
          undefined,
          startTime,
        );
        if (stopAt !== undefined) voice.stop(stopAt);
        voices.push(voice);
        manager.add(voice);
        return voice;
      },
      /** how many voices are audible at time `t` */
      soundingAt: (t: number) =>
        voices.filter((v) => v.startTime <= t && v.endTime > t).length,
    };
  }

  it("keeps the cap while earlier voices are still fading out (long release tail)", () => {
    const { add, soundingAt } = setup(1, 5);
    add(0, 1); // released at 1, fades until 6
    add(2);
    add(3);

    expect(soundingAt(3.5)).toBeLessThanOrEqual(1);
  });

  it("releases an older voice before cancelling chord notes", () => {
    const { add, voices, soundingAt } = setup(2, 0.3);
    add(0); // older, still playing
    [60, 64, 67].forEach(() => add(1)); // chord

    expect(soundingAt(1.5)).toBe(2);
    expect(voices[0].endTime).toBeCloseTo(1.01); // the older voice went first
    expect(voices[1].endTime).toBe(Infinity); // first chord note survives
    expect(voices[2].endTime).toBe(Infinity);
    expect(voices[3].endTime).toBe(1); // newest chord note cancelled
  });

  it("keeps the cap when several voices start at the same time (a chord)", () => {
    const { add, soundingAt } = setup(2, 0.3);
    [60, 64, 67, 72].forEach(() => add(1));

    expect(soundingAt(1.5)).toBeLessThanOrEqual(2);
  });
});
