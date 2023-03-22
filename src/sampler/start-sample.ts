import { connectSerial } from "./connect";
import { toMidi } from "./midi";
import { Subscribe, unsubscribeAll } from "./signals";

export type StopSample = {
  stopId?: string | number;
  time?: number;
};

export type SampleOptions = {
  decayTime?: number;
  detune?: number;
  gain?: number;
};

type SampleNote = {
  midi?: number;
  note?: string;
};

export type StartSample = {
  stopId?: string | number;
  buffer: AudioBuffer;
  destination: AudioNode;
  time?: number;
  duration?: number;
  decayTime?: number;
  detune?: number;
  gain?: number;
  lpfCutoffHz?: number;
  stop?: Subscribe<StopSample | undefined>;
};

export function getSampleNote<T extends SampleNote>(
  note: number | string | T
): T {
  if (typeof note === "number") {
    return { midi: note } as T;
  } else if (typeof note === "string") {
    return { note, midi: toMidi(note) } as T;
  } else {
    return { midi: note.midi ?? toMidi(note.note), ...note };
  }
}

export function startSample(sample: StartSample) {
  const context = sample.destination.context;
  // Buffer source
  const source = context.createBufferSource();
  source.buffer = sample.buffer;
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

  source.onended = unsubscribeAll([
    connectSerial([source, lpf, volume, decay, sample.destination]),
    sample.stop?.((sampleStop) => {
      if (
        sampleStop === undefined ||
        sampleStop.stopId === undefined ||
        sampleStop.stopId === sample.stopId
      ) {
        stop(sampleStop?.time);
      }
    }),
  ]);

  const startAt = sample.time || context.currentTime;
  source.start(startAt);

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
