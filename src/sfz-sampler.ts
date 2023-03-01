import { SamplerNote } from "./sampler";
import { AudioBuffers } from "./sampler/audio-buffers";
import { Channel } from "./sampler/channel";
import { midiVelToGain, toMidi } from "./sampler/note";
import { createTrigger, Trigger } from "./sampler/signals";
import { startSample, StopSample } from "./sampler/start-sample";
import { SfzInstrument } from "./sfz/sfz-kits";
import { loadSfzBuffers, loadSfzInstrument } from "./sfz/sfz-load";
import { findRegions } from "./sfz/sfz-regions";
import { Websfz } from "./sfz/websfz";

/**
 * Splendid Grand Piano options
 */
export type SfzSamplerConfig = {
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
    instrument: SfzInstrument | Websfz | string,
    options: Partial<SfzSamplerConfig>
  ) {
    this.#config = {
      destination: options.destination ?? context.destination,
      detune: 0,
      volume: options.volume ?? 100,
      velocity: options.velocity ?? 100,
      decayTime: 0.3,
    };
    this.buffers = {};
    this.#stop = createTrigger();

    this.#websfz = EMPTY_WEBSFZ;
    this.#load = loadSfzInstrument(instrument).then((result) => {
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

    console.log(">>>", note, regions.length);

    const stopAll = regions.map(([group, region]) => {
      console.log(">>>", region, this.buffers[region.sample]);
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
}
