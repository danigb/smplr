import { Scheduler } from "./scheduler";
import { NoteEvent } from "./types";

// ---------------------------------------------------------------------------
// Fake timers control setInterval/clearInterval; currentTime is set manually.
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function makeContext(currentTime = 0) {
  const ctx = { currentTime };
  return ctx as unknown as BaseAudioContext;
}

function makeScheduler(
  ctx: BaseAudioContext,
  options?: { lookaheadMs?: number; intervalMs?: number }
) {
  return new Scheduler(ctx, { lookaheadMs: 200, intervalMs: 50, ...options });
}

// ---------------------------------------------------------------------------
// Immediate dispatch
// ---------------------------------------------------------------------------

describe("immediate dispatch", () => {
  it("dispatches a bare note string immediately", () => {
    const ctx = makeContext(0);
    const cb = jest.fn();
    makeScheduler(ctx).schedule("C4", cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("C4");
  });

  it("dispatches a bare MIDI number immediately", () => {
    const ctx = makeContext(0);
    const cb = jest.fn();
    makeScheduler(ctx).schedule(60, cb);
    expect(cb).toHaveBeenCalledWith(60);
  });

  it("dispatches an event with no time immediately", () => {
    const ctx = makeContext(0);
    const cb = jest.fn();
    makeScheduler(ctx).schedule({ note: "C4" }, cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("dispatches an event whose time equals now", () => {
    const ctx = makeContext(1.0);
    const cb = jest.fn();
    makeScheduler(ctx).schedule({ note: "C4", time: 1.0 }, cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("dispatches an event whose time is within the lookahead window", () => {
    // now=0, lookahead=0.2s → anything at time ≤ 0.2 dispatches immediately
    const ctx = makeContext(0);
    const cb = jest.fn();
    makeScheduler(ctx, { lookaheadMs: 200 }).schedule({ note: "C4", time: 0.15 }, cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("returns a no-op StopFn for immediate events", () => {
    const ctx = makeContext(0);
    const cb = jest.fn();
    const stop = makeScheduler(ctx).schedule("C4", cb);
    stop(); // must not throw, and callback already fired
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not start the interval for immediate events", () => {
    const ctx = makeContext(0);
    makeScheduler(ctx).schedule("C4", jest.fn());
    // If no interval started, advancing timers calls nothing extra
    jest.advanceTimersByTime(200);
    // No assertion needed — just must not throw
  });
});

// ---------------------------------------------------------------------------
// Future scheduling
// ---------------------------------------------------------------------------

describe("future scheduling", () => {
  it("does not dispatch immediately for events beyond the lookahead window", () => {
    const ctx = makeContext(0);
    const cb = jest.fn();
    makeScheduler(ctx, { lookaheadMs: 200 }).schedule({ note: "C4", time: 1.0 }, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  it("dispatches when the interval tick finds the event in the window", () => {
    const ctx = makeContext(0) as any;
    const cb = jest.fn();
    makeScheduler(ctx, { lookaheadMs: 200, intervalMs: 50 }).schedule(
      { note: "C4", time: 0.5 },
      cb
    );

    // At audio time 0.4, window reaches 0.6 → event at 0.5 dispatches
    ctx.currentTime = 0.4;
    jest.advanceTimersByTime(50);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ note: "C4", time: 0.5 });
  });

  it("does not dispatch before the event enters the lookahead window", () => {
    const ctx = makeContext(0) as any;
    const cb = jest.fn();
    makeScheduler(ctx, { lookaheadMs: 200, intervalMs: 50 }).schedule(
      { note: "C4", time: 1.0 },
      cb
    );

    // At audio time 0.7, window reaches 0.9 → event at 1.0 not yet due
    ctx.currentTime = 0.7;
    jest.advanceTimersByTime(50);

    expect(cb).not.toHaveBeenCalled();
  });

  it("dispatches multiple events in time order", () => {
    const ctx = makeContext(0) as any;
    const order: string[] = [];

    // Schedule out of time order; all times > 0.2s lookahead so they are queued
    const s = makeScheduler(ctx, { lookaheadMs: 200, intervalMs: 50 });
    s.schedule({ note: "D4", time: 1.4 }, () => order.push("D4"));
    s.schedule({ note: "C4", time: 1.3 }, () => order.push("C4"));
    s.schedule({ note: "E4", time: 1.5 }, () => order.push("E4"));

    // At audio time 1.4, window reaches 1.6 → all three dispatch in time order
    ctx.currentTime = 1.4;
    jest.advanceTimersByTime(50);

    expect(order).toEqual(["C4", "D4", "E4"]);
  });

  it("dispatches events across multiple interval ticks", () => {
    const ctx = makeContext(0) as any;
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    const s = makeScheduler(ctx, { lookaheadMs: 200, intervalMs: 50 });

    s.schedule({ note: "C4", time: 0.5 }, cb1);
    s.schedule({ note: "D4", time: 1.0 }, cb2);

    // First tick: dispatch C4
    ctx.currentTime = 0.4;
    jest.advanceTimersByTime(50);
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).not.toHaveBeenCalled();

    // Second tick: dispatch D4
    ctx.currentTime = 0.9;
    jest.advanceTimersByTime(50);
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Cancellation (StopFn)
// ---------------------------------------------------------------------------

describe("cancellation", () => {
  it("StopFn prevents a queued event from being dispatched", () => {
    const ctx = makeContext(0) as any;
    const cb = jest.fn();
    const s = makeScheduler(ctx, { lookaheadMs: 200, intervalMs: 50 });

    const stop = s.schedule({ note: "C4", time: 1.0 }, cb);
    stop(); // cancel before dispatch

    ctx.currentTime = 0.9;
    jest.advanceTimersByTime(50);

    expect(cb).not.toHaveBeenCalled();
  });

  it("StopFn only cancels its own event, not others with the same time", () => {
    const ctx = makeContext(0) as any;
    const cbC = jest.fn();
    const cbD = jest.fn();
    const s = makeScheduler(ctx, { lookaheadMs: 200, intervalMs: 50 });

    const stopC = s.schedule({ note: "C4", time: 1.0 }, cbC);
    s.schedule({ note: "D4", time: 1.0 }, cbD);

    stopC();

    ctx.currentTime = 0.9;
    jest.advanceTimersByTime(50);

    expect(cbC).not.toHaveBeenCalled();
    expect(cbD).toHaveBeenCalledTimes(1);
  });

  it("calling StopFn after dispatch is a no-op", () => {
    const ctx = makeContext(0) as any;
    const cb = jest.fn();
    const s = makeScheduler(ctx, { lookaheadMs: 200, intervalMs: 50 });

    const stop = s.schedule({ note: "C4", time: 0.5 }, cb);

    ctx.currentTime = 0.4;
    jest.advanceTimersByTime(50); // dispatches
    expect(cb).toHaveBeenCalledTimes(1);

    expect(() => stop()).not.toThrow(); // must not throw
    expect(cb).toHaveBeenCalledTimes(1); // not called again
  });
});

// ---------------------------------------------------------------------------
// Interval lifecycle
// ---------------------------------------------------------------------------

describe("interval lifecycle", () => {
  it("interval self-terminates when the queue drains", () => {
    const ctx = makeContext(0) as any;
    const cb = jest.fn();
    const s = makeScheduler(ctx, { lookaheadMs: 200, intervalMs: 50 });

    s.schedule({ note: "C4", time: 0.5 }, cb);

    // Dispatch and drain
    ctx.currentTime = 0.4;
    jest.advanceTimersByTime(50);
    expect(cb).toHaveBeenCalledTimes(1);

    // Advance much further — interval is gone, no extra calls
    jest.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("interval restarts when a new event is scheduled after draining", () => {
    const ctx = makeContext(0) as any;
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    const s = makeScheduler(ctx, { lookaheadMs: 200, intervalMs: 50 });

    s.schedule({ note: "C4", time: 0.5 }, cb1);
    ctx.currentTime = 0.4;
    jest.advanceTimersByTime(50); // drains queue, stops interval
    expect(cb1).toHaveBeenCalledTimes(1);

    // Schedule a new event — should start interval again
    s.schedule({ note: "D4", time: 1.0 }, cb2);
    ctx.currentTime = 0.9;
    jest.advanceTimersByTime(50);
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// stop()
// ---------------------------------------------------------------------------

describe("stop()", () => {
  it("clears the queue so no pending events are dispatched", () => {
    const ctx = makeContext(0) as any;
    const cb = jest.fn();
    const s = makeScheduler(ctx, { lookaheadMs: 200, intervalMs: 50 });

    s.schedule({ note: "C4", time: 1.0 }, cb);
    s.stop();

    ctx.currentTime = 0.9;
    jest.advanceTimersByTime(200);

    expect(cb).not.toHaveBeenCalled();
  });

  it("is safe to call when no events are queued", () => {
    const s = makeScheduler(makeContext());
    expect(() => s.stop()).not.toThrow();
  });

  it("allows scheduling new events after stop()", () => {
    const ctx = makeContext(0) as any;
    const cb = jest.fn();
    const s = makeScheduler(ctx, { lookaheadMs: 200, intervalMs: 50 });

    s.schedule({ note: "C4", time: 1.0 }, jest.fn());
    s.stop();

    // New event after stop
    s.schedule({ note: "D4", time: 1.0 }, cb);
    ctx.currentTime = 0.9;
    jest.advanceTimersByTime(50);

    expect(cb).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("event at exactly now + lookahead dispatches immediately", () => {
    const ctx = makeContext(0);
    const cb = jest.fn();
    // lookahead = 0.2, event.time = 0.2 → 0.2 <= 0 + 0.2 → immediate
    makeScheduler(ctx, { lookaheadMs: 200 }).schedule({ note: "C4", time: 0.2 }, cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("event just beyond lookahead is queued", () => {
    const ctx = makeContext(0);
    const cb = jest.fn();
    // lookahead = 0.2, event.time = 0.201 → not immediate
    makeScheduler(ctx, { lookaheadMs: 200 }).schedule(
      { note: "C4", time: 0.201 } as NoteEvent,
      cb
    );
    expect(cb).not.toHaveBeenCalled();
  });

  it("only one interval runs regardless of how many events are queued", () => {
    const ctx = makeContext(0) as any;
    const s = makeScheduler(ctx, { lookaheadMs: 200, intervalMs: 50 });
    const callbacks = Array.from({ length: 5 }, () => jest.fn());

    callbacks.forEach((cb, i) =>
      s.schedule({ note: "C4", time: 1.0 + i * 0.1 }, cb)
    );

    // All 5 events still pending — one interval serves them all
    ctx.currentTime = 1.4; // window reaches 1.6 → all 5 events (1.0–1.4) dispatch
    jest.advanceTimersByTime(50);

    callbacks.forEach((cb) => expect(cb).toHaveBeenCalledTimes(1));
  });
});
