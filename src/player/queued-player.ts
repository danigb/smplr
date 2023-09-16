import { SortedQueue } from "./sorted-queue";
import {
  InternalPlayer,
  SampleOptions,
  SampleStart,
  SampleStop,
} from "./types";

type SampleStartWithTime = SampleStart & { time: number };

/**
 * A SamplePlayer that queues up samples to be played in the future.
 *
 * @private
 */

export class QueuedPlayer implements InternalPlayer {
  private readonly player: InternalPlayer;
  #queue: SortedQueue<SampleStartWithTime>;
  #intervalId: NodeJS.Timeout | undefined;

  public constructor(player: InternalPlayer, options: Partial<SampleOptions>) {
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
    if (startAt < now + 1) {
      return this.player.start(sample);
    }
    this.#queue.push({ ...sample, time: startAt });

    if (!this.#intervalId) {
      this.#intervalId = setInterval(() => {
        const nextTick = context.currentTime + 1;
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
      }, 200);
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
