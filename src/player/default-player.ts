import { Channel, ChannelOptions, OutputChannel } from "./channel";
import { QueuedPlayer } from "./queued-player";
import { SamplePlayer } from "./sample-player";
import {
  InternalPlayer,
  SampleOptions,
  SampleStart,
  SampleStop,
} from "./types";

type PlayerOptions = ChannelOptions & SampleOptions;

/**
 * Player used by instruments
 * @private
 */
export class DefaultPlayer implements InternalPlayer {
  public readonly output: OutputChannel;
  private readonly player: InternalPlayer;

  constructor(
    public readonly context: BaseAudioContext,
    options: Partial<PlayerOptions>
  ) {
    const channel = new Channel(context, options);
    this.player = new QueuedPlayer(
      new SamplePlayer(context.destination, options),
      options
    );
    this.output = channel;
  }

  get buffers() {
    return this.player.buffers;
  }

  public start(sample: SampleStart) {
    return this.player.start(sample);
  }

  public stop(sample?: SampleStop | string | number) {
    this.player.stop(
      typeof sample === "object"
        ? sample
        : sample !== undefined
        ? { stopId: sample }
        : undefined
    );
  }

  disconnect() {
    this.output.disconnect();
    this.player.disconnect();
  }
}
