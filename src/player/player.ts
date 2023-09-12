import { Channel, ChannelOptions, OutputChannel } from "./channel";
import { AudioBuffers } from "./load-audio";
import { QueuedPlayer } from "./player-queue";
import { SampleOptions, SampleStart, SampleStop } from "./player-sample";

type PlayerOptions = ChannelOptions & SampleOptions;

/**
 * Player used by instruments
 * @private
 */
export class Player {
  public readonly buffers: AudioBuffers;
  public readonly output: OutputChannel;
  #player: QueuedPlayer;

  constructor(
    public readonly context: BaseAudioContext,
    options: Partial<PlayerOptions>
  ) {
    const channel = new Channel(context, options);
    this.#player = new QueuedPlayer(channel.input, options);
    this.buffers = this.#player.buffers;
    this.output = channel;
  }

  public start(sample: SampleStart) {
    this.#player.start(sample);
  }

  public stop(sample?: SampleStop | string | number) {
    this.#player.stop(sample);
  }
}
