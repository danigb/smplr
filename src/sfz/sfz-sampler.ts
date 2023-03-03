import { AudioBuffers } from "../sampler/audio-buffers";
import { Channel } from "../sampler/channel";
import { midiVelToGain, toMidi } from "../sampler/note";
import { SamplerNote } from "../sampler/sampler";
import { createTrigger, Trigger } from "../sampler/signals";
import { startSample, StopSample } from "../sampler/start-sample";
import { SfzInstrument } from "./sfz-kits";
import { loadSfzBuffers, loadSfzInstrument } from "./sfz-load";
import { findRegions } from "./sfz-regions";
import { Websfz } from "./websfz";

/**
 * Splendid Grand Piano options
 */
export type SfzSamplerConfig = {
  instrument: SfzInstrument | Websfz | string;
  destination: AudioNode;
  volume: number;
  velocity: number;
  detune: number;
  decayTime: number;
  lpfCutoffHz?: number;
};

const EMPTY_WEBSFZ: Websfz = Object.freeze({
  meta: {},
  global: {},
  groups: [],
});

export class SfzSampler {
  public readonly output: Omit<Channel, "input">;
  public readonly buffers: AudioBuffers;
  #websfz: Websfz;
  #config: SfzSamplerConfig;
  #stop: Trigger<StopSample | undefined>;
  #load: Promise<void>;
  #output: Channel;

  constructor(
    public readonly context: AudioContext,
    options: Partial<SfzSamplerConfig> & Pick<SfzSamplerConfig, "instrument">
  ) {
    this.#config = {
      instrument: options.instrument,
      destination: options.destination ?? context.destination,
      detune: 0,
      volume: options.volume ?? 100,
      velocity: options.velocity ?? 100,
      decayTime: 0.3,
    };
    this.buffers = {};
    this.#stop = createTrigger();

    this.#websfz = EMPTY_WEBSFZ;
    this.#load = loadSfzInstrument(options.instrument).then((result) => {
      this.#websfz = Object.freeze(result);
      return loadSfzBuffers(context, this.buffers, this.#websfz);
    });
    this.#output = new Channel(context, this.#config);
    this.output = this.#output;
  }
  async loaded(): Promise<this> {
    await this.#load;
    return this;
  }

  start(note: SamplerNote | string | number) {
    const _note: SamplerNote = typeof note === "object" ? note : { note: note };
    const midi = toMidi(_note.note);
    if (midi === undefined) return () => undefined;

    const velocity = _note.velocity ?? this.#config.velocity;
    const regions = findRegions(this.#websfz, { midi, velocity });

    const stopAll = regions.map(([group, region]) => {
      let target = region.pitch_keycenter ?? region.key ?? midi;
      const detune = (midi - target) * 100;

      const destination = (this.output as Channel).input;

      return startSample({
        buffer: this.buffers[region.sample] ?? null,
        destination,
        decayTime: _note.decayTime ?? this.#config.decayTime,
        detune: detune + (_note.detune ?? this.#config.detune),
        gain: midiVelToGain(_note.velocity ?? this.#config.velocity),
        time: _note.time,
        duration: _note.duration,
        stop: this.#stop.subscribe,
        stopId: _note.stopId ?? _note.note,
      });
    });
    return (time?: number) => stopAll.forEach((stop) => stop(time));
  }

  stop(note?: StopSample | string | number) {
    const note_ = typeof note === "object" ? note : { stopId: note };
    this.#stop.trigger(note_);
  }

  disconnect() {
    this.stop();
    this.#output.disconnect();
  }
}
