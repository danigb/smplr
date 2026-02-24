import { Sequencer, SequencerNote } from "./sequencer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function makeContext(currentTime = 0) {
  const ctx = { currentTime };
  return ctx as unknown as BaseAudioContext;
}

function makeInstrument() {
  return { start: jest.fn() };
}

// bpm=120, ppq=96 → secondsPerTick = 60/(120*96) ≈ 0.005208
// 1 quarter note (96 ticks) = 0.5s
// 1 bar (4/4, 384 ticks) = 2.0s
const PPQ = 96;
const BPM = 120;

function makeSeq(
  ctx: BaseAudioContext,
  opts: ConstructorParameters<typeof Sequencer>[1] = {},
) {
  return new Sequencer(ctx, {
    bpm: BPM,
    ppq: PPQ,
    lookaheadMs: 200,
    intervalMs: 50,
    ...opts,
  });
}

// Simple score: one note per beat (beats 1-4) in bar 1.
// at 120bpm, ppq=96: beat 1 = t=0, beat 2 = t=0.5s, beat 3 = t=1.0s, beat 4 = t=1.5s
function beatNotes(): SequencerNote[] {
  return [
    { note: "C4", at: "1:1", duration: "8n" },
    { note: "E4", at: "1:2", duration: "8n" },
    { note: "G4", at: "1:3", duration: "8n" },
    { note: "C5", at: "1:4", duration: "8n" },
  ];
}

// ---------------------------------------------------------------------------
// 1. Initial state
// ---------------------------------------------------------------------------

describe("initial state", () => {
  it("starts stopped", () => {
    expect(makeSeq(makeContext()).state).toBe("stopped");
  });

  it("bpm defaults to 120", () => {
    const ctx = makeContext();
    const seq = new Sequencer(ctx, { ppq: PPQ });
    expect(seq.bpm).toBe(120);
  });

  it("loop defaults to false", () => {
    expect(makeSeq(makeContext()).loop).toBe(false);
  });

  it("position is 1:1:0 before start", () => {
    expect(makeSeq(makeContext()).position).toBe("1:1:0");
  });
});

// ---------------------------------------------------------------------------
// 2. Lifecycle — start / pause / stop
// ---------------------------------------------------------------------------

describe("lifecycle", () => {
  it("start() → playing", () => {
    const seq = makeSeq(makeContext(0));
    seq.start();
    expect(seq.state).toBe("playing");
  });

  it("start() is idempotent when already playing", () => {
    const seq = makeSeq(makeContext(0));
    seq.start();
    seq.start(); // second call should not throw or double-start
    expect(seq.state).toBe("playing");
  });

  it("pause() → paused", () => {
    const seq = makeSeq(makeContext(0));
    seq.start();
    seq.pause();
    expect(seq.state).toBe("paused");
  });

  it("pause() is a no-op when stopped", () => {
    const seq = makeSeq(makeContext(0));
    seq.pause();
    expect(seq.state).toBe("stopped");
  });

  it("stop() → stopped", () => {
    const seq = makeSeq(makeContext(0));
    seq.start();
    seq.stop();
    expect(seq.state).toBe("stopped");
  });

  it("stop() resets position to 1:1:0", () => {
    const ctx = makeContext(0) as any;
    const seq = makeSeq(ctx);
    seq.start();
    ctx.currentTime = 1.0;
    seq.stop();
    expect(seq.position).toBe("1:1:0");
  });

  it("start() after pause resumes from the paused position", () => {
    const ctx = makeContext(0) as any;
    const seq = makeSeq(ctx);
    seq.start();
    ctx.currentTime = 1.0; // 1 full bar = 1s of music (at 120bpm, 2 beats in)
    seq.pause();
    const posAtPause = seq.position;
    ctx.currentTime = 5.0; // time passes while paused
    seq.start(); // resume — no offset arg
    expect(seq.position).toBe(posAtPause);
  });

  it("start(offsetTick) overrides pause position", () => {
    const ctx = makeContext(0) as any;
    const seq = makeSeq(ctx);
    seq.start();
    ctx.currentTime = 1.0;
    seq.pause();
    seq.start(0); // explicit offset: restart from tick 0
    expect(seq.position).toBe("1:1:0");
  });

  it("emits 'start' on start()", () => {
    const onStart = jest.fn();
    const seq = makeSeq(makeContext(0));
    seq.on("start", onStart);
    seq.start();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("emits 'pause' on pause()", () => {
    const onPause = jest.fn();
    const seq = makeSeq(makeContext(0));
    seq.on("pause", onPause);
    seq.start();
    seq.pause();
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("emits 'stop' on stop()", () => {
    const onStop = jest.fn();
    const seq = makeSeq(makeContext(0));
    seq.on("stop", onStop);
    seq.start();
    seq.stop();
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 3. Note scheduling — basic
// ---------------------------------------------------------------------------

describe("note scheduling", () => {
  it("dispatches notes with their correct audio times", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const seq = makeSeq(ctx);
    // One note at beat 1 (tick 0 = t=0) and one at beat 2 (tick 96 = t=0.5s)
    seq.addTrack(inst, [
      { note: "C4", at: "1:1" },
      { note: "E4", at: "1:2" },
    ]);
    seq.start();

    // First flush: window [0, 0.2s] — neither note is in window yet
    // (beat 1 at t=0 is exactly at now, inside the window; beat 2 at t=0.5 is outside)
    // Actually: lookahead=200ms, so window=[0, 0.2]. Tick 0 → t=0 ≤ 0.2 → included
    // Tick 96 → t=0.5 > 0.2 → excluded
    jest.advanceTimersByTime(50);
    expect(inst.start).toHaveBeenCalledTimes(1);
    expect(inst.start.mock.calls[0][0]).toMatchObject({ note: "C4", time: 0 });

    // Second flush: window [0.2, 0.25s] — beat 2 at t=0.5 still not in window
    ctx.currentTime = 0.05;
    jest.advanceTimersByTime(50);
    expect(inst.start).toHaveBeenCalledTimes(1); // no new notes

    // Advance to t=0.35s → window [0.2, 0.55] → beat 2 at t=0.5 dispatches
    ctx.currentTime = 0.35;
    jest.advanceTimersByTime(50);
    expect(inst.start).toHaveBeenCalledTimes(2);
    expect(inst.start.mock.calls[1][0]).toMatchObject({
      note: "E4",
      time: 0.5,
    });
  });

  it("does not double-schedule notes", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const seq = makeSeq(ctx);
    seq.addTrack(inst, [{ note: "C4", at: "1:1" }]);
    seq.start();

    // Fire multiple flushes at the same audio time
    jest.advanceTimersByTime(50);
    ctx.currentTime = 0; // time hasn't advanced
    jest.advanceTimersByTime(50);
    jest.advanceTimersByTime(50);

    expect(inst.start).toHaveBeenCalledTimes(1);
  });

  it("dispatches notes with correct duration in seconds", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const seq = makeSeq(ctx);
    // 4n at 120bpm, ppq=96 = 0.5s
    seq.addTrack(inst, [{ note: "C4", at: "1:1", duration: "4n" }]);
    seq.start();
    jest.advanceTimersByTime(50);

    expect(inst.start).toHaveBeenCalledWith(
      expect.objectContaining({ duration: expect.closeTo(0.5, 5) }),
    );
  });

  it("dispatches note velocity (default 100)", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const seq = makeSeq(ctx);
    seq.addTrack(inst, [{ note: "C4", at: "1:1" }]);
    seq.start();
    jest.advanceTimersByTime(50);
    expect(inst.start).toHaveBeenCalledWith(
      expect.objectContaining({ velocity: 100 }),
    );
  });

  it("forwards custom velocity from the note", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const seq = makeSeq(ctx);
    seq.addTrack(inst, [{ note: "C4", at: "1:1", velocity: 64 }]);
    seq.start();
    jest.advanceTimersByTime(50);
    expect(inst.start).toHaveBeenCalledWith(
      expect.objectContaining({ velocity: 64 }),
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Multi-track
// ---------------------------------------------------------------------------

describe("multi-track", () => {
  it("routes notes to the correct instrument", () => {
    const ctx = makeContext(0) as any;
    const piano = makeInstrument();
    const drums = makeInstrument();
    const seq = makeSeq(ctx);

    seq.addTrack(piano, [{ note: "C4", at: "1:1" }]);
    seq.addTrack(drums, [{ note: "kick", at: "1:1" }]);

    seq.start();
    jest.advanceTimersByTime(50);

    expect(piano.start).toHaveBeenCalledWith(
      expect.objectContaining({ note: "C4" }),
    );
    expect(drums.start).toHaveBeenCalledWith(
      expect.objectContaining({ note: "kick" }),
    );
  });

  it("removeTrack stops events for that instrument only", () => {
    const ctx = makeContext(0) as any;
    const piano = makeInstrument();
    const drums = makeInstrument();
    const seq = makeSeq(ctx);

    seq.addTrack(piano, [{ note: "C4", at: "1:1" }]);
    seq.addTrack(drums, [{ note: "kick", at: "1:1" }]);
    seq.removeTrack(piano);

    seq.start();
    jest.advanceTimersByTime(50);

    expect(piano.start).not.toHaveBeenCalled();
    expect(drums.start).toHaveBeenCalledTimes(1);
  });

  it("clearTracks removes all instruments", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const seq = makeSeq(ctx);
    seq.addTrack(inst, [{ note: "C4", at: "1:1" }]);
    seq.clearTracks();
    seq.start();
    jest.advanceTimersByTime(50);
    expect(inst.start).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. Position
// ---------------------------------------------------------------------------

describe("position", () => {
  it("reports bar:beat:tick format", () => {
    // tick 0 → bar 1, beat 1, tick 0
    const seq = makeSeq(makeContext(0));
    expect(seq.position).toBe("1:1:0");
  });

  it("advances while playing", () => {
    const ctx = makeContext(0) as any;
    const seq = makeSeq(ctx);
    seq.start();
    // 0.5s @ 120bpm, ppq=96 = 96 ticks = beat 2 of bar 1
    ctx.currentTime = 0.5;
    expect(seq.position).toBe("1:2:0");
  });

  it("position at 2 full bars is bar 3, beat 1", () => {
    const ctx = makeContext(0) as any;
    const seq = makeSeq(ctx);
    seq.start();
    // 2 bars = 384*2 = 768 ticks = 4.0s
    ctx.currentTime = 4.0;
    expect(seq.position).toBe("3:1:0");
  });

  it("seek via position setter while stopped", () => {
    const ctx = makeContext(0);
    const seq = makeSeq(ctx);
    seq.position = "2:1"; // bar 2, beat 1 = 384 ticks
    expect(seq.position).toBe("2:1:0");
  });

  it("seek via position setter while playing", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const seq = makeSeq(ctx);
    seq.addTrack(inst, [{ note: "C4", at: "1:1" }]);
    seq.start();
    jest.advanceTimersByTime(50); // dispatches C4

    // Seek back to bar 1, beat 1
    ctx.currentTime = 0.05;
    seq.position = "1:1";

    // Flush again — C4 should be re-dispatched at the new audio time
    jest.advanceTimersByTime(50);
    expect(inst.start).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 6. BPM
// ---------------------------------------------------------------------------

describe("bpm", () => {
  it("bpm getter returns current bpm", () => {
    expect(makeSeq(makeContext()).bpm).toBe(BPM);
  });

  it("bpm setter changes future note times", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    // Score: one note at beat 2 (tick 96, currently = 0.5s at 120bpm)
    const seq = makeSeq(ctx, { bpm: 120 });
    seq.addTrack(inst, [{ note: "E4", at: "1:2" }]);
    seq.start();

    // Flush passes beat 1 window with nothing (note at beat 2)
    jest.advanceTimersByTime(50);

    // At t=0.4s, change BPM to 60 → 1 beat now takes 1.0s
    // Beat 2 is at tick 96; from tick 0 at t=0: 0 + 96*spt(60) = 1.0s
    // But there's already a checkpoint at t=0 with bpm=120.
    // After change at t=0.4: new checkpoint {tick≈76.8, t=0.4, bpm=60}
    // tick 96 is 96-76.8=19.2 ticks past checkpoint: 0.4 + 19.2*(60/(60*96)) = 0.4+0.2 = 0.6s
    ctx.currentTime = 0.4;
    seq.bpm = 60;

    ctx.currentTime = 0.45; // window [0.2, 0.65] → note at 0.6 dispatches
    jest.advanceTimersByTime(50);
    expect(inst.start).toHaveBeenCalledTimes(1);
    const scheduledTime = inst.start.mock.calls[0][0].time;
    // At 60bpm from tick 76.8 at t=0.4: 0.4 + (96-76.8)/96 = 0.6s
    expect(scheduledTime).toBeCloseTo(0.6, 2);
  });
});

// ---------------------------------------------------------------------------
// 7. Loop
// ---------------------------------------------------------------------------

describe("loop", () => {
  it("loop defaults to false", () => {
    expect(makeSeq(makeContext()).loop).toBe(false);
  });

  it("loopEnd defaults to totalTicks", () => {
    const ctx = makeContext(0);
    const inst = makeInstrument();
    const seq = makeSeq(ctx);
    // note at beat 3 (tick 192) with duration quarter (96 ticks) → totalTicks = 288
    seq.addTrack(inst, [{ note: "C4", at: "1:3", duration: "4n" }]);
    expect(seq.loopEnd).toBe(288);
  });

  it("loopEnd setter overrides the default", () => {
    const seq = makeSeq(makeContext());
    seq.loopEnd = "1m";
    expect(seq.loopEnd).toBe(PPQ * 4); // 384
  });

  it("replays notes after the loop boundary", () => {
    // 1 bar = 384 ticks = 2.0s; note at tick 0 (beat 1)
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const seq = makeSeq(ctx, { loop: true, loopEnd: "1m" });
    seq.addTrack(inst, [{ note: "C4", at: "1:1" }]);
    seq.start();

    // First flush: dispatches C4 at t=0
    jest.advanceTimersByTime(50);
    expect(inst.start).toHaveBeenCalledTimes(1);
    expect(inst.start.mock.calls[0][0]).toMatchObject({ note: "C4", time: 0 });

    // Advance to just before loop end: window [1.9s, 2.1s] crosses 2.0s boundary
    ctx.currentTime = 1.9;
    jest.advanceTimersByTime(50);

    // C4 should be dispatched again for the 2nd iteration, at t=2.0
    expect(inst.start).toHaveBeenCalledTimes(2);
    expect(inst.start.mock.calls[1][0]).toMatchObject({
      note: "C4",
      time: expect.closeTo(2.0, 4),
    });
  });

  it("emits 'loop' event on each loop boundary crossing", () => {
    const ctx = makeContext(0) as any;
    const onLoop = jest.fn();
    const seq = makeSeq(ctx, { loop: true, loopEnd: "1m" });
    seq.on("loop", onLoop);
    seq.addTrack(makeInstrument(), []);
    seq.start();

    // Trigger first loop boundary
    ctx.currentTime = 1.9;
    jest.advanceTimersByTime(50);
    expect(onLoop).toHaveBeenCalledTimes(1);

    // Trigger second loop boundary
    ctx.currentTime = 3.9;
    jest.advanceTimersByTime(50);
    expect(onLoop).toHaveBeenCalledTimes(2);
  });

  it("progress is 0 when loop=false", () => {
    const ctx = makeContext(0) as any;
    const seq = makeSeq(ctx, { loop: false });
    seq.start();
    ctx.currentTime = 1.0;
    expect(seq.progress).toBe(0);
  });

  it("progress is [0,1] within the loop range", () => {
    const ctx = makeContext(0) as any;
    const seq = makeSeq(ctx, { loop: true, loopEnd: "1m" });
    seq.addTrack(makeInstrument(), []);
    seq.start();

    ctx.currentTime = 0; // tick 0 = start of loop
    expect(seq.progress).toBeCloseTo(0);

    ctx.currentTime = 1.0; // tick 192 = halfway through 1 bar
    expect(seq.progress).toBeCloseTo(0.5);

    ctx.currentTime = 2.0; // tick 384 = just past loop end (wraps)
    // After seekAt, clock is in new iteration; tick 0 → progress 0
    // But we haven't flushed yet, so clock doesn't know about loop restart.
    // This test checks progress BEFORE the loop boundary flush.
    // At t=2.0, the clock (without seekAt) gives tick=384 which equals loopEnd.
    // Progress = (384 - 0) / 384 = 1.0 (clamped). That's expected before flush.
    expect(seq.progress).toBeCloseTo(1, 1);
  });
});

// ---------------------------------------------------------------------------
// 8. Auto-stop (non-looping)
// ---------------------------------------------------------------------------

describe("auto-stop", () => {
  it("emits 'end' and stops after the score finishes", () => {
    const ctx = makeContext(0) as any;
    const onEnd = jest.fn();
    const seq = makeSeq(ctx);
    // Single note at beat 1, duration = quarter (tick 0, ends at tick 96 = t=0.5s)
    seq.addTrack(makeInstrument(), [{ note: "C4", at: "1:1", duration: "4n" }]);
    seq.on("end", onEnd);
    seq.start();

    // Advance past the end: at t=0.4s, window reaches 0.6s > 0.5s = end
    ctx.currentTime = 0.4;
    jest.advanceTimersByTime(50); // flush that sees end

    expect(onEnd).not.toHaveBeenCalled(); // setTimeout not fired yet

    // Fire the end setTimeout (delay = max(0, 0.5-0.4)*1000 = 100ms)
    jest.advanceTimersByTime(200);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(seq.state).toBe("stopped");
  });

  it("does not emit 'end' when looping", () => {
    const ctx = makeContext(0) as any;
    const onEnd = jest.fn();
    const seq = makeSeq(ctx, { loop: true, loopEnd: "1m" });
    seq.addTrack(makeInstrument(), [{ note: "C4", at: "1:1", duration: "4n" }]);
    seq.on("end", onEnd);
    seq.start();

    ctx.currentTime = 5.0;
    jest.advanceTimersByTime(500);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("does not emit 'end' twice", () => {
    const ctx = makeContext(0) as any;
    const onEnd = jest.fn();
    const seq = makeSeq(ctx);
    seq.addTrack(makeInstrument(), [{ note: "C4", at: "1:1", duration: "4n" }]);
    seq.on("end", onEnd);
    seq.start();

    ctx.currentTime = 0.4;
    jest.advanceTimersByTime(50);
    jest.advanceTimersByTime(50);
    jest.advanceTimersByTime(50);
    jest.advanceTimersByTime(500);

    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 9. scheduleRepeat
// ---------------------------------------------------------------------------

describe("scheduleRepeat", () => {
  it("fires the callback every interval", () => {
    const ctx = makeContext(0) as any;
    const cb = jest.fn();
    const seq = makeSeq(ctx, {
      lookaheadMs: 200,
      intervalMs: 50,
      loop: true,
      loopEnd: "4m",
    });
    seq.addTrack(makeInstrument(), []);
    seq.scheduleRepeat(cb, "4n"); // every quarter note = 0.5s
    seq.start();

    // Window [0, 0.2s]: beat at t=0 fires
    jest.advanceTimersByTime(50);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeCloseTo(0); // audio time 0

    // Window advances to include t=0.5s (next quarter note)
    ctx.currentTime = 0.35;
    jest.advanceTimersByTime(50);
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls[1][0]).toBeCloseTo(0.5);
  });

  it("cancel function removes the repeat event", () => {
    const ctx = makeContext(0) as any;
    const cb = jest.fn();
    const seq = makeSeq(ctx, { loop: true, loopEnd: "4m" });
    seq.addTrack(makeInstrument(), []);
    const cancel = seq.scheduleRepeat(cb, "4n");
    seq.start();

    jest.advanceTimersByTime(50); // fires once at t=0
    cancel();

    ctx.currentTime = 0.35;
    jest.advanceTimersByTime(50); // t=0.5 would fire — but cancelled
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("respects startAt offset", () => {
    const ctx = makeContext(0) as any;
    const cb = jest.fn();
    // Start repeat at beat 2 (tick 96 = t=0.5s)
    const seq = makeSeq(ctx, { loop: true, loopEnd: "4m" });
    seq.addTrack(makeInstrument(), []);
    seq.scheduleRepeat(cb, "4n", "1:2");
    seq.start();

    // First flush: window [0, 0.2s] — startAt=t=0.5 is outside window
    jest.advanceTimersByTime(50);
    expect(cb).not.toHaveBeenCalled();

    // Advance to window [0.35, 0.55] — t=0.5 is in window
    ctx.currentTime = 0.35;
    jest.advanceTimersByTime(50);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeCloseTo(0.5);
  });
});

// ---------------------------------------------------------------------------
// 10. Beat / bar events
// ---------------------------------------------------------------------------

describe("beat and bar events", () => {
  it("emits 'beat' for each beat in the scheduled window", () => {
    const ctx = makeContext(0) as any;
    const beats: number[] = [];
    const seq = makeSeq(ctx, { loop: true, loopEnd: "4m" });
    seq.addTrack(makeInstrument(), []);
    seq.on("beat", (beat: number) => beats.push(beat));
    seq.start();

    // Window [0, 0.2s]: beat 1 at t=0 fires (only partial bar covered)
    jest.advanceTimersByTime(50);
    expect(beats).toContain(1);

    // Advance to cover beat 2 (t=0.5s)
    ctx.currentTime = 0.35;
    jest.advanceTimersByTime(50);
    expect(beats).toContain(2);
  });

  it("emits 'bar' on bar boundaries", () => {
    const ctx = makeContext(0) as any;
    const bars: number[] = [];
    const seq = makeSeq(ctx, { loop: true, loopEnd: "4m" });
    seq.addTrack(makeInstrument(), []);
    seq.on("bar", (bar: number) => bars.push(bar));
    seq.start();

    // Bar 1 starts at tick 0 → t=0, inside first window
    jest.advanceTimersByTime(50);
    expect(bars).toContain(1);

    // Bar 2 starts at tick 384 → t=2.0s
    ctx.currentTime = 1.85;
    jest.advanceTimersByTime(50);
    expect(bars).toContain(2);
  });

  it("beat audio times match the clock", () => {
    const ctx = makeContext(0) as any;
    const beatTimes: number[] = [];
    const seq = makeSeq(ctx, { loop: true, loopEnd: "4m" });
    seq.addTrack(makeInstrument(), []);
    seq.on("beat", (_beat: number, time: number) => beatTimes.push(time));
    seq.start();

    jest.advanceTimersByTime(50);
    // Beat 1 at tick 0 → t=0
    expect(beatTimes[0]).toBeCloseTo(0);
  });
});

// ---------------------------------------------------------------------------
// 11. Humanize
// ---------------------------------------------------------------------------

describe("humanize", () => {
  it("timing offset is within the declared range", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const seq = makeSeq(ctx, { humanize: { timingMs: 50 } });
    seq.addTrack(inst, [{ note: "C4", at: "1:1" }]);
    seq.start();
    jest.advanceTimersByTime(50);

    const timingRange = 0.05; // ±50ms
    const scheduledTime = inst.start.mock.calls[0][0].time;
    expect(scheduledTime).toBeGreaterThanOrEqual(-timingRange);
    expect(scheduledTime).toBeLessThanOrEqual(timingRange);
  });

  it("velocity offset is within the declared range", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const velRange = 10;
    const seq = makeSeq(ctx, { humanize: { velocity: velRange } });
    seq.addTrack(inst, [{ note: "C4", at: "1:1", velocity: 100 }]);
    seq.start();
    jest.advanceTimersByTime(50);

    const velocity = inst.start.mock.calls[0][0].velocity;
    expect(velocity).toBeGreaterThanOrEqual(100 - velRange);
    expect(velocity).toBeLessThanOrEqual(100 + velRange);
  });
});

// ---------------------------------------------------------------------------
// 12. on / off
// ---------------------------------------------------------------------------

describe("on / off", () => {
  it("on() registers a listener that receives events", () => {
    const cb = jest.fn();
    const seq = makeSeq(makeContext(0));
    seq.on("start", cb);
    seq.start();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("off() removes a listener", () => {
    const cb = jest.fn();
    const seq = makeSeq(makeContext(0));
    seq.on("start", cb);
    seq.off("start", cb);
    seq.start();
    expect(cb).not.toHaveBeenCalled();
  });

  it("multiple listeners for the same event all fire", () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    const seq = makeSeq(makeContext(0));
    seq.on("start", cb1);
    seq.on("start", cb2);
    seq.start();
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("on() is chainable", () => {
    const seq = makeSeq(makeContext(0));
    expect(seq.on("start", jest.fn())).toBe(seq);
  });
});

// ---------------------------------------------------------------------------
// noteOn / noteOff events
// ---------------------------------------------------------------------------

describe("noteOn / noteOff events", () => {
  it("passes onStart and onEnded callbacks to instrument.start()", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const seq = makeSeq(ctx);
    seq.addTrack(inst, [{ note: "C4", at: "1:1" }]);
    seq.start();
    jest.advanceTimersByTime(50);

    const call = inst.start.mock.calls[0][0];
    expect(call.noteId).toBe(0); // default: note array index
    expect(typeof call.onStart).toBe("function");
    expect(typeof call.onEnded).toBe("function");
  });

  it("emits noteOn when instrument calls onStart", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const onNoteOn = jest.fn();
    const seq = makeSeq(ctx);
    seq.on("noteOn", onNoteOn);
    seq.addTrack(inst, [{ note: "C4", at: "1:1", duration: "4n" }]);
    seq.start();
    jest.advanceTimersByTime(50);

    // Simulate the instrument calling onStart
    const call = inst.start.mock.calls[0][0];
    call.onStart({ noteId: call.noteId });

    expect(onNoteOn).toHaveBeenCalledTimes(1);
    const event = onNoteOn.mock.calls[0][0];
    expect(event.noteId).toBe(0);
    expect(event.trackIndex).toBe(0);
    expect(event.noteIndex).toBe(0);
    expect(event.note).toMatchObject({ note: "C4", at: "1:1" });
  });

  it("emits noteOff when instrument calls onEnded", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const onNoteOff = jest.fn();
    const seq = makeSeq(ctx);
    seq.on("noteOff", onNoteOff);
    seq.addTrack(inst, [{ note: "C4", at: "1:1", duration: "4n" }]);
    seq.start();
    jest.advanceTimersByTime(50);

    // Simulate the instrument calling onEnded
    const call = inst.start.mock.calls[0][0];
    call.onEnded({ noteId: call.noteId });

    expect(onNoteOff).toHaveBeenCalledTimes(1);
    const event = onNoteOff.mock.calls[0][0];
    expect(event.noteId).toBe(0);
    expect(event.trackIndex).toBe(0);
    expect(event.noteIndex).toBe(0);
  });

  it("uses custom id from SequencerNote as noteId", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const onNoteOn = jest.fn();
    const seq = makeSeq(ctx);
    seq.on("noteOn", onNoteOn);
    seq.addTrack(inst, [{ id: "intro-c4", note: "C4", at: "1:1" }]);
    seq.start();
    jest.advanceTimersByTime(50);

    const call = inst.start.mock.calls[0][0];
    expect(call.noteId).toBe("intro-c4");

    call.onStart({ noteId: call.noteId });
    expect(onNoteOn.mock.calls[0][0].noteId).toBe("intro-c4");
  });

  it("defaults noteId to array index when no id provided", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const seq = makeSeq(ctx);
    seq.addTrack(inst, [
      { note: "C4", at: "1:1" },
      { note: "E4", at: "1:2" },
    ]);
    seq.start();

    // First flush: note 0 at t=0
    jest.advanceTimersByTime(50);
    expect(inst.start.mock.calls[0][0].noteId).toBe(0);

    // Advance to get note 1 scheduled
    ctx.currentTime = 0.35;
    jest.advanceTimersByTime(50);
    expect(inst.start.mock.calls[1][0].noteId).toBe(1);
  });

  it("provides correct trackIndex for multi-track", () => {
    const ctx = makeContext(0) as any;
    const inst1 = makeInstrument();
    const inst2 = makeInstrument();
    const onNoteOn = jest.fn();
    const seq = makeSeq(ctx);
    seq.on("noteOn", onNoteOn);
    seq.addTrack(inst1, [{ note: "C4", at: "1:1" }]);
    seq.addTrack(inst2, [{ note: "kick", at: "1:1" }]);
    seq.start();
    jest.advanceTimersByTime(50);

    // Track 0
    const call0 = inst1.start.mock.calls[0][0];
    call0.onStart({ noteId: call0.noteId });
    expect(onNoteOn.mock.calls[0][0].trackIndex).toBe(0);

    // Track 1
    const call1 = inst2.start.mock.calls[0][0];
    call1.onStart({ noteId: call1.noteId });
    expect(onNoteOn.mock.calls[1][0].trackIndex).toBe(1);
  });

  it("emits noteOn/noteOff on each loop iteration", () => {
    const ctx = makeContext(0) as any;
    const inst = makeInstrument();
    const onNoteOn = jest.fn();
    const seq = makeSeq(ctx, { loop: true, loopEnd: "1:2" });
    seq.on("noteOn", onNoteOn);
    seq.addTrack(inst, [{ note: "C4", at: "1:1" }]);
    seq.start();

    // First iteration: note at t=0
    jest.advanceTimersByTime(50);
    expect(inst.start).toHaveBeenCalledTimes(1);

    // Advance past loop end (0.5s at 120bpm for "1:2") into second iteration
    ctx.currentTime = 0.4;
    jest.advanceTimersByTime(50);

    // The note should be scheduled again for the second loop iteration
    expect(inst.start.mock.calls.length).toBeGreaterThanOrEqual(2);

    // Both calls should have onStart callbacks
    for (const call of inst.start.mock.calls) {
      expect(typeof call[0].onStart).toBe("function");
      call[0].onStart({ noteId: call[0].noteId });
    }
    expect(onNoteOn.mock.calls.length).toBe(inst.start.mock.calls.length);
  });
});
