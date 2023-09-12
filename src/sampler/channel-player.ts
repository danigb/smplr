import { Channel, ChannelOptions, OutputChannel } from "./channel";
import { AudioBuffers } from "./load-audio";
import { QueuedPlayer } from "./queued-player";
import { SampleStart, SampleStop } from "./sample-player";

/**
 * QueuedPlayer with an output channel
 */
export class ChannelPlayer {
  public readonly buffers: AudioBuffers;
  public readonly output: OutputChannel;
  #player: QueuedPlayer;

  constructor(
    public readonly context: BaseAudioContext,
    options: Partial<ChannelOptions>
  ) {
    const channel = new Channel(context, options);
    this.#player = new QueuedPlayer(channel.input);
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
