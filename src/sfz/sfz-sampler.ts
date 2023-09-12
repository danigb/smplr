import { Channel } from "../player/channel";
import { AudioBuffers } from "../player/load-audio";
import { midiVelToGain, toMidi } from "../player/midi";
import { SamplerNote } from "../player/sampler";
import { Trigger, createTrigger } from "../player/signals";
import { StopSample, startSample } from "../player/start-sample";
import { HttpStorage, Storage } from "../storage";
import { SfzInstrument } from "./sfz-kits";
import { loadSfzBuffers, loadSfzInstrument } from "./sfz-load";
import { findRegions } from "./sfz-regions";
import { Websfz } from "./websfz";

/**
 * Splendid Grand Piano options
 */
export type SfzSamplerConfig = {
  instrument: SfzInstrument | Websfz | string;
  storage?: Storage;
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

    const storage = options.storage ?? HttpStorage;
    this.#websfz = EMPTY_WEBSFZ;
    this.#load = loadSfzInstrument(options.instrument, storage).then(
      (result) => {
        this.#websfz = Object.freeze(result);
        return loadSfzBuffers(context, this.buffers, this.#websfz, storage);
      }
    );
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

      let buffer = this.buffers[region.sample];
      if (!buffer) {
        console.warn(`Sample not found: ${region.sample}`);
        return () => undefined;
      }

      const onEnded = _note.onEnded;

      return startSample({
        buffer,
        destination,
        decayTime: _note.decayTime ?? this.#config.decayTime,
        detune: detune + (_note.detune ?? this.#config.detune),
        gain: midiVelToGain(_note.velocity ?? this.#config.velocity),
        time: _note.time,
        duration: _note.duration,
        stop: this.#stop.subscribe,
        stopId: _note.stopId ?? _note.note,
        onEnded: onEnded ? () => onEnded(note) : undefined,
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
