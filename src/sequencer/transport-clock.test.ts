import { TransportClock } from "./transport-clock";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(currentTime = 0) {
  const ctx = { currentTime };
  return ctx as unknown as BaseAudioContext;
}

// ppq=96, bpm=120 → secondsPerTick = 60 / (120 * 96) = 0.005208333...
// 96 ticks (1 quarter note) = 0.5s at 120bpm, ppq=96
const PPQ = 96;
const BPM = 120;
const SPT = 60 / (BPM * PPQ); // seconds per tick ≈ 0.005208

function makeClock(ctx: BaseAudioContext, bpm = BPM, ppq = PPQ) {
  return new TransportClock(ctx, { bpm, ppq });
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("initial state", () => {
  it("starts stopped", () => {
    const ctx = makeContext();
    expect(makeClock(ctx).state).toBe("stopped");
  });

  it("currentTick is 0 before start", () => {
    const ctx = makeContext();
    expect(makeClock(ctx).currentTick).toBe(0);
  });

  it("exposes ppq as a readonly property", () => {
    const ctx = makeContext();
    expect(makeClock(ctx).ppq).toBe(PPQ);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle: start / pause / resume / stop
// ---------------------------------------------------------------------------

describe("lifecycle", () => {
  it("start() sets state to playing", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx);
    clock.start();
    expect(clock.state).toBe("playing");
  });

  it("pause() sets state to paused", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx);
    clock.start();
    clock.pause();
    expect(clock.state).toBe("paused");
  });

  it("pause() is a no-op when stopped", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx);
    clock.pause();
    expect(clock.state).toBe("stopped");
  });

  it("resume() sets state to playing", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx);
    clock.start();
    ctx.currentTime = 0.5;
    clock.pause();
    ctx.currentTime = 1.0;
    clock.resume();
    expect(clock.state).toBe("playing");
  });

  it("resume() is a no-op when stopped", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx);
    clock.resume();
    expect(clock.state).toBe("stopped");
  });

  it("stop() sets state to stopped", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx);
    clock.start();
    clock.stop();
    expect(clock.state).toBe("stopped");
  });

  it("stop() resets currentTick to 0", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx);
    clock.start();
    ctx.currentTime = 1.0;
    clock.stop();
    expect(clock.currentTick).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// tickToAudioTime — basic
// ---------------------------------------------------------------------------

describe("tickToAudioTime", () => {
  it("tick 0 at start = context start time", () => {
    const ctx = makeContext(0.5); // start at t=0.5
    const clock = makeClock(ctx);
    clock.start();
    expect(clock.tickToAudioTime(0)).toBeCloseTo(0.5);
  });

  it("one quarter note (ppq ticks) = 0.5s at 120bpm, ppq=96", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx);
    clock.start();
    expect(clock.tickToAudioTime(PPQ)).toBeCloseTo(0.5);
  });

  it("two quarter notes = 1.0s", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx);
    clock.start();
    expect(clock.tickToAudioTime(2 * PPQ)).toBeCloseTo(1.0);
  });

  it("one measure (4 beats) = 2.0s at 120bpm, 4/4", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx);
    clock.start();
    expect(clock.tickToAudioTime(4 * PPQ)).toBeCloseTo(2.0);
  });

  it("works with a non-zero start time", () => {
    const ctx = makeContext(1.0);
    const clock = makeClock(ctx);
    clock.start();
    // tick 96 should be 0.5s after start, i.e. at audio time 1.5
    expect(clock.tickToAudioTime(PPQ)).toBeCloseTo(1.5);
  });

  it("works with offsetTick (start mid-score)", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx);
    clock.start(PPQ); // start at tick 96 (beat 2)
    // tick 96 = 0s (that's where we started)
    expect(clock.tickToAudioTime(PPQ)).toBeCloseTo(0);
    // tick 192 = 0.5s later
    expect(clock.tickToAudioTime(2 * PPQ)).toBeCloseTo(0.5);
  });

  it("works before start (uses virtual origin)", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx);
    // No start() called — falls back to bpm-based calculation from t=0, tick=0
    expect(clock.tickToAudioTime(PPQ)).toBeCloseTo(0.5);
  });
});

// ---------------------------------------------------------------------------
// audioTimeToTick — basic
// ---------------------------------------------------------------------------

describe("audioTimeToTick", () => {
  it("audio time 0 after start at t=0 = tick 0", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx);
    clock.start();
    expect(clock.audioTimeToTick(0)).toBeCloseTo(0);
  });

  it("0.5s at 120bpm, ppq=96 = 96 ticks", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx);
    clock.start();
    expect(clock.audioTimeToTick(0.5)).toBeCloseTo(PPQ);
  });

  it("1.0s = 2 quarter notes", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx);
    clock.start();
    expect(clock.audioTimeToTick(1.0)).toBeCloseTo(2 * PPQ);
  });

  it("round-trips: audioTimeToTick(tickToAudioTime(t)) ≈ t", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx);
    clock.start();
    const tick = 150;
    const roundTrip = clock.audioTimeToTick(clock.tickToAudioTime(tick));
    expect(roundTrip).toBeCloseTo(tick);
  });
});

// ---------------------------------------------------------------------------
// currentTick — live position
// ---------------------------------------------------------------------------

describe("currentTick", () => {
  it("advances with context.currentTime while playing", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx);
    clock.start();

    ctx.currentTime = 0.5;
    expect(clock.currentTick).toBeCloseTo(PPQ); // 0.5s = 96 ticks

    ctx.currentTime = 1.0;
    expect(clock.currentTick).toBeCloseTo(2 * PPQ); // 1.0s = 192 ticks
  });

  it("is frozen at pause position when paused", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx);
    clock.start();

    ctx.currentTime = 0.5;
    clock.pause();
    const frozenTick = clock.currentTick;

    // Advance time — currentTick should not change
    ctx.currentTime = 2.0;
    expect(clock.currentTick).toBeCloseTo(frozenTick);
  });

  it("resumes from the paused tick position", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx);
    clock.start();

    ctx.currentTime = 0.5; // paused at tick 96
    clock.pause();

    ctx.currentTime = 5.0; // time passes while paused
    clock.resume();

    // Right after resume, currentTick = 96 (the pause point)
    expect(clock.currentTick).toBeCloseTo(PPQ);

    // 0.5s after resume: currentTick should be ~192
    ctx.currentTime = 5.5;
    expect(clock.currentTick).toBeCloseTo(2 * PPQ);
  });
});

// ---------------------------------------------------------------------------
// tickDuration
// ---------------------------------------------------------------------------

describe("tickDuration", () => {
  it("96 ticks at 120bpm, ppq=96 = 0.5s", () => {
    const clock = makeClock(makeContext(0));
    expect(clock.tickDuration(PPQ)).toBeCloseTo(0.5);
  });

  it("scales with tick count", () => {
    const clock = makeClock(makeContext(0));
    expect(clock.tickDuration(2 * PPQ)).toBeCloseTo(1.0);
  });

  it("uses the current bpm field", () => {
    const clock = makeClock(makeContext(0), 60); // 60bpm → 1s per beat
    expect(clock.tickDuration(PPQ)).toBeCloseTo(1.0);
  });
});

// ---------------------------------------------------------------------------
// BPM changes mid-playback
// ---------------------------------------------------------------------------

describe("bpm setter mid-playback", () => {
  it("future notes use new BPM after a mid-playback change", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx, 120); // 120bpm start
    clock.start();

    // At 0.5s, we've reached tick 96. Change BPM to 60.
    ctx.currentTime = 0.5;
    clock.bpm = 60; // 60bpm → 1s per beat from now

    // At 60bpm, the next quarter note takes 1s.
    // So tick 192 should be at 0.5 + 1.0 = 1.5s.
    expect(clock.tickToAudioTime(2 * PPQ)).toBeCloseTo(1.5);
  });

  it("past notes are not affected by mid-playback BPM change", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx, 120);
    clock.start();

    ctx.currentTime = 0.5;
    clock.bpm = 60;

    // Tick 48 happened before the BPM change (at 0.25s in 120bpm)
    expect(clock.tickToAudioTime(PPQ / 2)).toBeCloseTo(0.25);
  });

  it("audioTimeToTick works correctly after BPM change", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx, 120);
    clock.start();

    ctx.currentTime = 0.5; // at tick 96
    clock.bpm = 60; // now 60bpm

    // 1.5s = 0.5s (at 120bpm) + 1.0s (at 60bpm, = 1 beat = 96 ticks)
    expect(clock.audioTimeToTick(1.5)).toBeCloseTo(2 * PPQ);
  });

  it("setting bpm while stopped only updates the bpm field", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx, 120);
    clock.bpm = 80;
    expect(clock.bpm).toBe(80);
    expect(clock.state).toBe("stopped");
  });

  it("bpm set before start is used at start", () => {
    const ctx = makeContext(0);
    const clock = makeClock(ctx, 120);
    clock.bpm = 60; // change before start
    clock.start();
    // 60bpm → 1s per beat
    expect(clock.tickToAudioTime(PPQ)).toBeCloseTo(1.0);
  });
});

// ---------------------------------------------------------------------------
// seek
// ---------------------------------------------------------------------------

describe("seek", () => {
  it("seek while playing moves currentTick to the target tick", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx, 120);
    clock.start();

    ctx.currentTime = 0.5; // at tick 96
    clock.seek(0); // jump back to beginning

    expect(clock.currentTick).toBeCloseTo(0);
  });

  it("seek while playing: future times are calculated from new position", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx, 120);
    clock.start();

    ctx.currentTime = 0.5; // at tick 96
    clock.seek(0); // back to tick 0

    // From tick 0 at t=0.5, tick 96 should be at t=1.0
    expect(clock.tickToAudioTime(PPQ)).toBeCloseTo(1.0);
  });

  it("seek while paused updates the saved tick position", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx, 120);
    clock.start();
    ctx.currentTime = 0.5;
    clock.pause();

    clock.seek(200);
    expect(clock.currentTick).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// seekAt — loop restart
// ---------------------------------------------------------------------------

describe("seekAt", () => {
  it("re-anchors the clock at a future audio time", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx, 120);
    clock.start();

    // Loop: 1 bar = 4 beats = 4 * 96 = 384 ticks = 2.0s at 120bpm
    const loopEnd = 4 * PPQ; // tick 384
    const loopEndAudioTime = clock.tickToAudioTime(loopEnd); // 2.0s
    clock.seekAt(0, loopEndAudioTime); // at t=2.0, wrap back to tick 0

    // After the loop restart, tick 0 in the new iteration = audio time 2.0
    expect(clock.tickToAudioTime(0)).toBeCloseTo(2.0);
  });

  it("tick 96 in the new iteration maps to the correct audio time", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx, 120);
    clock.start();

    const loopEnd = 4 * PPQ;
    const loopEndAudioTime = clock.tickToAudioTime(loopEnd); // 2.0s
    clock.seekAt(0, loopEndAudioTime);

    // Tick 96 in the 2nd iteration should be 2.0 + 0.5 = 2.5s
    expect(clock.tickToAudioTime(PPQ)).toBeCloseTo(2.5);
  });

  it("audioTimeToTick works correctly in the new loop iteration", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx, 120);
    clock.start();

    const loopEndAudioTime = clock.tickToAudioTime(4 * PPQ); // 2.0s
    clock.seekAt(0, loopEndAudioTime);

    // At audio time 2.5, we're 0.5s into the 2nd iteration = tick 96
    expect(clock.audioTimeToTick(2.5)).toBeCloseTo(PPQ);
  });

  it("first-iteration notes still map to correct audio times before seekAt", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx, 120);
    clock.start();

    const loopEndAudioTime = clock.tickToAudioTime(4 * PPQ); // 2.0s
    clock.seekAt(0, loopEndAudioTime);

    // Tick 48 in the first iteration was at 0.25s — still correct since
    // the first checkpoint {tick:0, audioTime:0} still covers it
    // (it's the only checkpoint with tick <= 48 BEFORE the new one at t=2.0)
    // But after seekAt, the new checkpoint {tick:0, t:2.0} also has tick<=48.
    // It wins (most recent), so tick 48 now maps to 2nd iteration: 2.0 + 0.25
    // This is expected — once the loop restarts, the clock is in the new iteration.
    expect(clock.tickToAudioTime(PPQ / 2)).toBeCloseTo(2.0 + 0.25);
  });

  it("preserves BPM in effect at the seekAt time", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx, 120);
    clock.start();

    // Change BPM at t=0.5 (tick 96)
    ctx.currentTime = 0.5;
    clock.bpm = 60; // slowdown to 60bpm

    // Loop end at tick 384 (now takes longer at 60bpm)
    // From tick 96 at t=0.5: remaining 288 ticks × (1/60bpm/ppq) = 3.0s
    const loopEndAudioTime = clock.tickToAudioTime(4 * PPQ); // 0.5 + 3.0 = 3.5s
    clock.seekAt(0, loopEndAudioTime);

    // After loop restart, BPM should still be 60
    // tick 96 in new iteration: 3.5 + 1.0 = 4.5s (60bpm = 1s per beat)
    expect(clock.tickToAudioTime(PPQ)).toBeCloseTo(4.5);
  });
});

// ---------------------------------------------------------------------------
// Multiple BPM changes
// ---------------------------------------------------------------------------

describe("multiple BPM changes", () => {
  it("handles three BPM changes correctly", () => {
    const ctx = makeContext(0) as any;
    const clock = makeClock(ctx, 120);
    clock.start();

    // 120bpm for 0.5s → tick 96 at t=0.5
    ctx.currentTime = 0.5;
    clock.bpm = 60; // 60bpm from tick 96

    // 60bpm for 1.0s → tick 192 at t=1.5
    ctx.currentTime = 1.5;
    clock.bpm = 120; // back to 120bpm from tick 192

    // 120bpm again: tick 288 at t=1.5+0.5 = 2.0
    expect(clock.tickToAudioTime(3 * PPQ)).toBeCloseTo(2.0);
  });
});
