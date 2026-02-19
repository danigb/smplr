import { Channel, ChannelConfig, OutputChannel } from "./channel";
import { createEmptySamplerInstrument, findSamplesInRegions } from "./layers";
import { toMidi } from "../smplr/midi";
import { QueuedPlayer, QueuedPlayerConfig } from "./queued-player";
import { SamplePlayer } from "./sample-player";
import {
  InternalPlayer,
  SampleOptions,
  SampleStart,
  SampleStop,
  SamplerInstrument,
  StopFn,
} from "./types";

export type RegionPlayerOptions = ChannelConfig &
  SampleOptions &
  QueuedPlayerConfig;

/**
 * A player with an channel output and a region group to read samples info from
 * @private
 */
export class RegionPlayer implements InternalPlayer {
  public readonly output: OutputChannel;
  public instrument: SamplerInstrument;
  private readonly player: InternalPlayer;
  private seqNum = 0;

  constructor(
    public readonly context: BaseAudioContext,
    options: Partial<RegionPlayerOptions>
  ) {
    const channel = new Channel(context, options);
    this.instrument = createEmptySamplerInstrument(options);
    this.player = new QueuedPlayer(
      new SamplePlayer(context, { ...options, destination: channel.input }),
      options
    );
    this.output = channel;
  }

  get buffers() {
    return this.player.buffers;
  }

  start(sample: SampleStart | string | number) {
    const stopAll: StopFn[] = [];
    const sampleStart = typeof sample === "object" ? sample : { note: sample };
    for (const group of this.instrument.groups) {
      const found = findSamplesInRegions(group, sampleStart, this.seqNum);
      this.seqNum++;
      for (const sample of found) {
        let stop = this.player.start(sample);
        stopAll.push(stop);
      }
    }
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
