import {
  SampleOptions,
  SamplePlayer,
  SampleStart,
  SampleStop,
} from "./sample-player";
import { SortedQueue } from "./sorted-queue";

type SampleStartWithTime = SampleStart & { time: number };

/**
 * A SamplePlayer that queues up samples to be played in the future.
 *
 * @private
 */

export class QueuedPlayer {
  private readonly player: SamplePlayer;
  #queue: SortedQueue<SampleStartWithTime>;
  #intervalId: NodeJS.Timeout | undefined;

  public constructor(
    public readonly destination: AudioNode,
    options: Partial<SampleOptions>
  ) {
    this.#queue = new SortedQueue<SampleStartWithTime>(
      (a, b) => a.time - b.time
    );
    this.player = new SamplePlayer(destination, options);
  }

  get buffers() {
    return this.player.buffers;
  }

  get isRunning() {
    return this.#intervalId !== undefined;
  }

  public start(sample: SampleStart) {
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

  public stop(sample?: SampleStop | string | number) {
    this.player.stop(sample);

    if (sample) {
      const stopId = typeof sample === "object" ? sample.stopId : sample;
      const time = typeof sample === "object" ? sample.time : undefined;
      if (stopId) {
        this.#queue.removeAll((item) =>
          item.stopId ? item.stopId === stopId : item.note === stopId
        );
      } else if (time) {
        this.#queue.removeAll((item) => item.time >= time);
      } else {
        this.#queue.clear();
      }
    } else {
      this.#queue.clear();
    }
  }
}
