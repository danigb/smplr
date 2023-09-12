import { connectSerial } from "./connect";
import { AudioBuffers } from "./load-audio";
import { midiVelToGain } from "./midi";
import { Subscribe, Trigger, createTrigger, unsubscribeAll } from "./signals";

export type SampleStop = {
  stopId?: string | number;
  time?: number;
};

export type SampleOptions = {
  decayTime?: number;
  detune?: number;
  // null can be used to override default
  duration?: number | null;
  velocity?: number;
  lpfCutoffHz?: number;
};

export type SampleStart = {
  note: string | number;
  onEnded?: (sample: SampleStart) => void;
  stop?: Subscribe<SampleStop | undefined>;
  stopId?: string | number;
  time?: number;
} & SampleOptions;

export type SamplePlayerOptions = {
  velocityToGain?: (velocity: number) => number;
} & SampleOptions;

/**
 * A sample player. This is used internally by the Sampler.
 *
 * @private Not intended for public use
 */
export class SamplePlayer {
  public readonly context: BaseAudioContext;
  public readonly buffers: AudioBuffers;
  #stop: Trigger<SampleStop | undefined>;
  velocityToGain: (velocity: number) => number;

  public constructor(
    public readonly destination: AudioNode,
    private readonly options: Partial<SamplePlayerOptions>
  ) {
    this.context = destination.context;
    this.buffers = {};
    this.#stop = createTrigger();
    this.velocityToGain = options.velocityToGain ?? midiVelToGain;
  }

  public start(sample: SampleStart) {
    const { destination, context } = this;
    const buffer = this.buffers[sample.note];
    if (!buffer) {
      console.warn(`Sample not found: '${sample.note}'`);
      return () => undefined;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.detune.value = sample.detune ?? this.options.detune ?? 0;

    // Low pass filter
    const lpfCutoffHz = sample.lpfCutoffHz ?? this.options.lpfCutoffHz;
    const lpf = lpfCutoffHz
      ? new BiquadFilterNode(context, {
          type: "lowpass",
          frequency: sample.lpfCutoffHz,
        })
      : undefined;

    // Sample volume
    const volume = context.createGain();
    const velocity = sample.velocity ?? this.options.velocity ?? 100;
    volume.gain.value = this.velocityToGain(velocity);

    // Release decay
    const decayTime = sample.decayTime ?? this.options.decayTime;
    const [decay, startDecay] = createDecayEnvelope(context, decayTime);

    const stopId = sample.stopId ?? sample.note;
    const cleanup = unsubscribeAll([
      connectSerial([source, lpf, volume, decay, destination]),
      sample.stop?.((sampleStop) => {
        if (
          sampleStop === undefined ||
          sampleStop.stopId === undefined ||
          sampleStop.stopId === stopId
        ) {
          stop(sampleStop?.time);
        }
      }),
    ]);
    source.onended = () => {
      cleanup();
      sample.onEnded?.(sample);
    };

    const startAt = Math.max(sample.time ?? 0, context.currentTime);
    source.start(sample.time);

    function stop(time?: number) {
      time ??= context.currentTime;
      if (time <= startAt) {
        source.stop(time);
      } else {
        const stopAt = startDecay(time);
        source.stop(stopAt);
      }
    }

    let duration = sample.duration ?? buffer.duration;
    if (typeof sample.duration == "number") {
      stop(startAt + duration);
    }

    return stop;
  }

  public stop(sample?: SampleStop | string | number) {
    this.#stop.trigger(
      typeof sample === "object" ? sample : { stopId: sample }
    );
  }
}

function createDecayEnvelope(
  context: BaseAudioContext,
  envelopeTime = 0.2
): [AudioNode, (time: number) => number] {
  let stopAt = 0;
  const envelope = new GainNode(context, { gain: 1.0 });

  function start(time: number): number {
    if (stopAt) return stopAt;
    envelope.gain.cancelScheduledValues(time);
    const envelopeAt = time || context.currentTime;
    stopAt = envelopeAt + envelopeTime;
    envelope.gain.setValueAtTime(1.0, envelopeAt);
    envelope.gain.linearRampToValueAtTime(0, stopAt);

    return stopAt;
  }

  return [envelope, start];
}
