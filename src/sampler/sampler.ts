import { Channel } from "./channel";
import { AudioBuffers, loadAudioBuffer } from "./load-audio";
import { midiVelToGain } from "./midi";
import { createTrigger, Trigger } from "./signals";
import { startSample, StopSample } from "./start-sample";

/**
 * A function that downloads audio
 */
export type SamplerAudioLoader = (
  context: AudioContext,
  buffers: AudioBuffers
) => Promise<void>;

export type SamplerConfig = {
  detune: number;
  volume: number;
  velocity: number;
  decayTime?: number;
  lpfCutoffHz?: number;
  destination: AudioNode;

  buffers: Record<string | number, string | AudioBuffers> | SamplerAudioLoader;
  volumeToGain: (volume: number) => number;
  noteToSample: (
    note: SamplerNote,
    buffers: AudioBuffers,
    config: SamplerConfig
  ) => [string | number, number];
};

export type SamplerNote = {
  decayTime?: number;
  detune?: number;
  duration?: number;
  lpfCutoffHz?: number;
  note: string | number;
  onEnded?: (note: SamplerNote | string | number) => void;
  stopId?: string | number;
  time?: number;
  velocity?: number;
};

/**
 * A Sampler instrument
 *
 * @private
 */
export class Sampler {
  public readonly output: Omit<Channel, "input">;
  public readonly buffers: AudioBuffers;
  #config: SamplerConfig;
  #stop: Trigger<StopSample | undefined>;
  #load: Promise<void>;
  #output: Channel;

  public constructor(
    public readonly context: AudioContext,
    options: Partial<SamplerConfig> = {}
  ) {
    this.#config = {
      destination: options.destination ?? context.destination,
      detune: 0,
      volume: options.volume ?? 100,
      velocity: options.velocity ?? 100,
      buffers: options.buffers ?? {},
      volumeToGain: options.volumeToGain ?? midiVelToGain,
      noteToSample:
        options.noteToSample ?? ((note) => [note.note.toString(), 0]),
    };
    this.buffers = {};
    this.#stop = createTrigger();
    const loader =
      typeof this.#config.buffers === "function"
        ? this.#config.buffers
        : createAudioBuffersLoader(this.#config.buffers);
    this.#load = loader(context, this.buffers);
    this.#output = new Channel(context, this.#config);
    this.output = this.#output;
  }

  async loaded(): Promise<this> {
    await this.#load;
    return this;
  }

  start(note: SamplerNote | string | number) {
    const _note: SamplerNote = typeof note === "object" ? note : { note: note };
    const [sample, detune] = this.#config.noteToSample(
      _note,
      this.buffers,
      this.#config
    );
    const buffer = this.buffers[sample];
    if (!buffer) {
      console.warn(`Sample not found: '${sample}'`);
      return () => undefined;
    }
    const onEnded = _note.onEnded;
    return startSample({
      buffer,
      destination: this.#output.input,

      time: _note.time,
      duration: _note.duration,

      decayTime: _note.decayTime,
      lpfCutoffHz: _note.lpfCutoffHz,
      detune: detune + (_note.detune ?? this.#config.detune),
      gain: this.#config.volumeToGain(_note.velocity ?? this.#config.velocity),

      stop: this.#stop.subscribe,
      stopId: _note.stopId ?? _note.note,
      onEnded: onEnded ? () => onEnded(note) : undefined,
    });
  }

  stop(note?: StopSample | string | number) {
    const note_ = typeof note === "object" ? note : { stopId: note };
    this.#stop.trigger(note_);
  }
}

function createAudioBuffersLoader(
  source: Record<string | number, string | AudioBuffers>
): SamplerAudioLoader {
  return async (context, buffers) => {
    await Promise.all([
      Object.keys(source).map(async (key) => {
        const value = source[key];
        if (value instanceof AudioBuffer) {
          buffers[key] = value;
        } else if (typeof value === "string") {
          const buffer = await loadAudioBuffer(context, value);
          if (buffer) buffers[key] = buffer;
        }
      }),
    ]);
  };
}
