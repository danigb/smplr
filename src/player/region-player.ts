import { Channel, ChannelOptions, OutputChannel } from "./channel";
import { createEmptyRegionGroup, findSamplesInRegions } from "./layers";
import { toMidi } from "./midi";
import { QueuedPlayer } from "./queued-player";
import { SamplePlayer } from "./sample-player";
import {
  InternalPlayer,
  RegionGroup,
  SampleOptions,
  SampleStart,
  SampleStop,
} from "./types";

type PlayerOptions = ChannelOptions & SampleOptions;

/**
 * A player with an channel output and a region group to read samples info from
 * @private
 */
export class RegionPlayer implements InternalPlayer {
  public readonly output: OutputChannel;
  public readonly group: RegionGroup;
  private readonly player: InternalPlayer;
  private seqNum = 0;

  constructor(
    public readonly context: BaseAudioContext,
    options: Partial<PlayerOptions>
  ) {
    const channel = new Channel(context, options);
    this.group = createEmptyRegionGroup();
    this.player = new QueuedPlayer(
      new SamplePlayer(context.destination, options),
      options
    );
    this.output = channel;
  }

  get buffers() {
    return this.player.buffers;
  }

  start(sample: SampleStart | string | number) {
    const found = findSamplesInRegions(
      this.group,
      typeof sample === "object" ? sample : { note: sample },
      this.seqNum
    );
    this.seqNum++;
    const stopAll = found.map((sample) => this.player.start(sample));
    return (time?: number) => stopAll.forEach((stop) => stop(time));
  }

  stop(sample?: SampleStop | string | number) {
    if (sample == undefined) {
      this.player.stop();
      return;
    }

    const toStop = typeof sample === "object" ? sample : { stopId: sample };
    const midi = toMidi(toStop.stopId);
    if (!midi) return;
    toStop.stopId = midi;
    this.player.stop(toStop);
  }

  disconnect() {
    this.output.disconnect();
    this.player.disconnect();
  }
}
