import { asConstructable } from "./as-constructable";
import { SortedQueue } from "./sorted-queue";
import { NoteEvent, StopFn } from "./types";

const LOOKAHEAD_MS_DEFAULT = 200;
const INTERVAL_MS_DEFAULT = 50;

/**
 * Schedules note events for future dispatch. Used internally by every smplr
 * instrument; pass an instance via {@link SmplrOptions.scheduler} to share one
 * scheduler across multiple instruments.
 */
export interface Scheduler {
  /**
   * Dispatch `callback` at `event.time`. If `event.time` is within the
   * scheduler's lookahead window (or omitted), the callback fires synchronously
   * and the returned {@link StopFn} is a no-op. Otherwise the event is queued.
   *
   * The returned function removes the event from the queue before dispatch.
   */
  schedule(event: NoteEvent, callback: (event: NoteEvent) => void): StopFn;

  /**
   * Clear all queued (not-yet-dispatched) events and stop the polling
   * interval. Does not affect voices already playing.
   */
  stop(): void;
}

/** Options accepted by `Scheduler(context, options)`. */
export type SchedulerOptions = {
  /**
   * How far ahead of `currentTime` events are dispatched synchronously.
   * Defaults to 200ms.
   */
  lookaheadMs?: number;
  /**
   * How often the queue is polled for events ready to dispatch.
   * Defaults to 50ms.
   */
  intervalMs?: number;
};

type QueueItem = {
  time: number;
  event: NoteEvent;
  callback: (event: NoteEvent) => void;
};

class SchedulerImpl implements Scheduler {
  #context: BaseAudioContext;
  #lookaheadSec: number;
  #intervalMs: number;
  #queue: SortedQueue<QueueItem>;
  #intervalId: ReturnType<typeof setInterval> | undefined;

  constructor(context: BaseAudioContext, options?: SchedulerOptions) {
    this.#context = context;
    this.#lookaheadSec = (options?.lookaheadMs ?? LOOKAHEAD_MS_DEFAULT) / 1000;
    this.#intervalMs = options?.intervalMs ?? INTERVAL_MS_DEFAULT;
    this.#queue = new SortedQueue<QueueItem>((a, b) => a.time - b.time);
  }

  schedule(event: NoteEvent, callback: (event: NoteEvent) => void): StopFn {
    const now = this.#context.currentTime;
    const time = getEventTime(event) ?? now;

    if (time <= now + this.#lookaheadSec) {
      callback(event);
      return noOp;
    }

    const item: QueueItem = { time, event, callback };
    this.#queue.push(item);
    this.#ensureRunning();

    return () => {
      this.#queue.removeAll((q) => q === item);
    };
  }

  stop(): void {
    this.#queue.clear();
    if (this.#intervalId !== undefined) {
      clearInterval(this.#intervalId);
      this.#intervalId = undefined;
    }
  }

  #ensureRunning(): void {
    if (this.#intervalId !== undefined) return;

    this.#intervalId = setInterval(() => {
      const dispatchBefore = this.#context.currentTime + this.#lookaheadSec;

      while (
        this.#queue.size() > 0 &&
        this.#queue.peek()!.time <= dispatchBefore
      ) {
        const item = this.#queue.pop()!;
        item.callback(item.event);
      }

      // Self-terminate when the queue is empty
      if (this.#queue.size() === 0) {
        clearInterval(this.#intervalId);
        this.#intervalId = undefined;
      }
    }, this.#intervalMs);
  }
}

function getEventTime(event: NoteEvent): number | undefined {
  return typeof event === "object" ? event.time : undefined;
}

const noOp: StopFn = () => {};

type SchedulerFactory = {
  (context: BaseAudioContext, options?: SchedulerOptions): Scheduler;
  /** @deprecated Call as a function: `Scheduler(...)` instead of `new Scheduler(...)`. */
  new (context: BaseAudioContext, options?: SchedulerOptions): Scheduler;
};

export const Scheduler: SchedulerFactory = asConstructable(SchedulerImpl);
