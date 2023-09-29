import { DefaultPlayer, DefaultPlayerConfig } from "../player/default-player";
import { toMidi } from "../player/midi";
import { SampleStart, SampleStop } from "../player/types";
import { HttpStorage, Storage } from "../storage";
import { SfzInstrument } from "./sfz-kits";
import { SfzInstrumentLoader, loadSfzBuffers } from "./sfz-load";
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
  public readonly options: Readonly<Partial<SfzSamplerConfig>>;
  private readonly player: DefaultPlayer;
  #websfz: Websfz;
  public readonly load: Promise<this>;

  constructor(
    public readonly context: AudioContext,
    options: Partial<SfzSamplerConfig & DefaultPlayerConfig> &
      Pick<SfzSamplerConfig, "instrument">
  ) {
    this.options = Object.freeze(Object.assign({}, options));
    this.player = new DefaultPlayer(context, options);
    this.#websfz = EMPTY_WEBSFZ;

    const storage = options.storage ?? HttpStorage;
    this.load = SfzInstrumentLoader(options.instrument, storage)
      .then((result) => {
        this.#websfz = Object.freeze(result);
        return loadSfzBuffers(
          context,
          this.player.buffers,
          this.#websfz,
          storage
        );
      })
      .then(() => this);
  }

  get output() {
    return this.player.output;
  }

  async loaded() {
    console.warn("deprecated: use load instead");
    return this.load;
  }

  start(sample: SampleStart | string | number) {
    this.#startLayers(typeof sample === "object" ? sample : { note: sample });
  }

  stop(sample?: SampleStop | string | number) {
    this.player.stop(sample);
  }

  disconnect() {
    this.player.disconnect();
  }

  #startLayers(sample: SampleStart) {
    const midi = toMidi(sample.note);
    if (midi === undefined) return () => undefined;

    const velocity = sample.velocity ?? this.options.velocity;
    const regions = findRegions(this.#websfz, { midi, velocity });

    const onEnded = () => {
      sample.onEnded?.(sample);
    };

    const stopAll = regions.map(([group, region]) => {
      let target = region.pitch_keycenter ?? region.key ?? midi;
      const detune = (midi - target) * 100;
      return this.player.start({
        ...sample,
        note: region.sample,
        decayTime: sample.decayTime,
        detune: detune + (sample.detune ?? this.options.detune ?? 0),
        onEnded,
        stopId: midi,
      });
    });

    switch (stopAll.length) {
      case 0:
        return () => undefined;
      case 1:
        return stopAll[0];
      default:
        return (time?: number) => stopAll.forEach((stop) => stop(time));
    }
  }
}
