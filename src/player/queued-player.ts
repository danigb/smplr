import { SortedQueue } from "./sorted-queue";
import { InternalPlayer, SampleStart, SampleStop } from "./types";

type SampleStartWithTime = SampleStart & { time: number };

function compose<T>(a?: (x: T) => void, b?: (x: T) => void) {
  return a && b
    ? (x: T) => {
        a(x);
        b(x);
      }
    : a ?? b;
}

export type QueuedPlayerConfig = {
  scheduleLookaheadMs: number;
  scheduleIntervalMs: number;
  onStart?: (sample: SampleStart) => void;
  onEnded?: (sample: SampleStart) => void;
};

function getConfig(options: Partial<QueuedPlayerConfig>) {
  const config: QueuedPlayerConfig = {
    scheduleLookaheadMs: options.scheduleLookaheadMs ?? 200,
    scheduleIntervalMs: options.scheduleIntervalMs ?? 50,
    onStart: options.onStart,
    onEnded: options.onEnded,
  };

  if (config.scheduleLookaheadMs < 1) {
    throw Error("scheduleLookaheadMs must be greater than 0");
  }
  if (config.scheduleIntervalMs < 1) {
    throw Error("scheduleIntervalMs must be greater than 0");
  }
  if (config.scheduleLookaheadMs < config.scheduleIntervalMs) {
    throw Error("scheduleLookaheadMs must be greater than scheduleIntervalMs");
  }

  return config;
}

/**
 * A SamplePlayer that queues up samples to be played in the future.
 *
 * @private
 */
export class QueuedPlayer implements InternalPlayer {
  private readonly player: InternalPlayer;
  #config: QueuedPlayerConfig;
  #queue: SortedQueue<SampleStartWithTime>;
  #intervalId: NodeJS.Timeout | undefined;

  public constructor(
    player: InternalPlayer,
    options: Partial<QueuedPlayerConfig> = {}
  ) {
    this.#config = getConfig(options);

    this.#queue = new SortedQueue<SampleStartWithTime>(
      (a, b) => a.time - b.time
    );
    this.player = player;
  }

  get context() {
    return this.player.context;
  }

  get buffers() {
    return this.player.buffers;
  }

  get isRunning() {
    return this.#intervalId !== undefined;
  }

  start(sample: SampleStart) {
    const context = this.player.context;
    const now = context.currentTime;
    const startAt = sample.time ?? now;
    const lookAhead = this.#config.scheduleLookaheadMs / 1000;
    sample.onStart = compose(sample.onStart, this.#config.onStart);
    sample.onEnded = compose(sample.onEnded, this.#config.onEnded);

    if (startAt < now + lookAhead) {
      return this.player.start(sample);
    }
    this.#queue.push({ ...sample, time: startAt });

    if (!this.#intervalId) {
      this.#intervalId = setInterval(() => {
        const nextTick = context.currentTime + lookAhead;
        while (this.#queue.size() && this.#queue.peek()!.time <= nextTick) {
          const sample = this.#queue.pop();
          if (sample) {
            this.player.start(sample);
          }
        }
        if (!this.#queue.size()) {
          clearInterval(this.#intervalId!);
          this.#intervalId = undefined;
        }
      }, this.#config.scheduleIntervalMs);
    }

    return (time?: number) => {
      if (!time || time < startAt) {
        if (!this.#queue.removeAll((item) => item === sample)) {
          this.player.stop({ ...sample, time });
        }
      } else {
        this.player.stop({ ...sample, time });
      }
    };
  }

  stop(sample?: SampleStop) {
    this.player.stop(sample);

    if (!sample) {
      this.#queue.clear();
      return;
    }

    const time = sample?.time ?? 0;
    const stopId = sample?.stopId;
    if (stopId) {
      this.#queue.removeAll((item) =>
        item.time >= time && item.stopId
          ? item.stopId === stopId
          : item.note === stopId
      );
    } else {
      this.#queue.removeAll((item) => item.time >= time);
    }
  }

  disconnect() {
    this.player.disconnect();
  }
}
