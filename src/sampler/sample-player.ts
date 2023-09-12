import { connectSerial } from "./connect";
import { AudioBuffers } from "./load-audio";
import { Subscribe, Trigger, createTrigger, unsubscribeAll } from "./signals";

export type SampleStop = {
  stopId?: string | number;
  time?: number;
};

export type SampleStart = {
  sampleId: string;
  decayTime?: number;
  detune?: number;
  duration?: number;
  gain?: number;
  lpfCutoffHz?: number;
  onEnded?: (sample: SampleStart) => void;
  stop?: Subscribe<SampleStop | undefined>;
  stopId?: string;
  time?: number;
};

/**
 * A sample player. This is used internally by the Sampler.
 *
 * @private Not intended for public use
 */
export class SamplePlayer {
  public readonly context: BaseAudioContext;
  public readonly buffers: AudioBuffers;
  #stop: Trigger<SampleStop | undefined>;

  public constructor(public readonly destination: AudioNode) {
    this.context = destination.context;
    this.buffers = {};
    this.#stop = createTrigger();
  }

  public start(sample: SampleStart) {
    const { destination, context } = this;
    const buffer = this.buffers[sample.sampleId];
    if (!buffer) {
      console.warn(`Sample not found: '${sample}'`);
      return () => undefined;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.detune.value = sample?.detune ?? 0;

    // Low pass filter
    const lpf = sample.lpfCutoffHz
      ? new BiquadFilterNode(context, {
          type: "lowpass",
          frequency: sample.lpfCutoffHz,
        })
      : undefined;

    // Sample volume
    const volume = context.createGain();
    volume.gain.value = sample?.gain ?? 1.0;

    // Release decay
    const [decay, startDecay] = createDecayEnvelope(context, sample.decayTime);

    const stopId = sample.stopId ?? sample.sampleId;
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

    if (sample.duration !== undefined) {
      stop(startAt + sample.duration);
    }

    return stop;
  }

  public stop(sample?: SampleStop | string) {
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
