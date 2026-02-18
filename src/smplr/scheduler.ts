import { SortedQueue } from "../player/sorted-queue";
import { NoteEvent, StopFn } from "./types";

const LOOKAHEAD_MS_DEFAULT = 200;
const INTERVAL_MS_DEFAULT = 50;

type QueueItem = {
  time: number;
  event: NoteEvent;
  callback: (event: NoteEvent) => void;
};

/**
 * Standalone scheduler. Dispatches NoteEvents immediately when they fall within the
 * lookahead window, or queues them for future dispatch via a self-managing interval.
 *
 * Multiple Smplr instances can share a single Scheduler for coordinated timing.
 */
export class Scheduler {
  #context: BaseAudioContext;
  #lookaheadSec: number;
  #intervalMs: number;
  #queue: SortedQueue<QueueItem>;
  #intervalId: ReturnType<typeof setInterval> | undefined;

  constructor(
    context: BaseAudioContext,
    options?: { lookaheadMs?: number; intervalMs?: number }
  ) {
    this.#context = context;
    this.#lookaheadSec = (options?.lookaheadMs ?? LOOKAHEAD_MS_DEFAULT) / 1000;
    this.#intervalMs = options?.intervalMs ?? INTERVAL_MS_DEFAULT;
    this.#queue = new SortedQueue<QueueItem>((a, b) => a.time - b.time);
  }

  /**
   * Schedule a callback for a NoteEvent.
   *
   * - If the event's time falls within the lookahead window (or has no time), the
   *   callback is called synchronously and a no-op StopFn is returned.
   * - Otherwise the event is queued, the interval is started if needed, and a StopFn
   *   is returned that removes the event from the queue before it is dispatched.
   */
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

  /**
   * Clear all queued (not-yet-dispatched) events and stop the interval.
   * Does not affect voices that are already playing.
   */
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

      while (this.#queue.size() > 0 && this.#queue.peek()!.time <= dispatchBefore) {
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
