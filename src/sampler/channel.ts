import { AudioInsert, connectSerial } from "./connect";
import { midiVelToGain } from "./note";
import { createControl } from "./signals";

type ChannelOptions = {
  destination: AudioNode;
  volume: number;
  volumeToGain: (volume: number) => number;
};

type Send = {
  name: string;
  mix: GainNode;
  disconnect: () => void;
};

/**
 * @private
 */
export class Channel {
  public readonly setVolume: (vol: number) => void;
  public readonly input: AudioNode;

  #volume: GainNode;
  #sends?: Send[];
  #inserts?: (AudioNode | AudioInsert)[];
  #disconnect: () => void;
  #unsubscribe: () => void;
  #options: Readonly<ChannelOptions>;

  constructor(
    public readonly context: AudioContext,
    options: Partial<ChannelOptions>
  ) {
    this.#options = Object.freeze({
      destination: context.destination,
      volume: 100,
      volumeToGain: midiVelToGain,
      ...options,
    });

    this.input = new GainNode(this.context);
    this.#volume = new GainNode(this.context);

    this.#disconnect = connectSerial([
      this.input,
      this.#volume,
      this.#options.destination,
    ]);

    const volume = createControl(options.volume ?? 100);
    this.setVolume = volume.set;
    const volumeToGain = options.volumeToGain ?? midiVelToGain;
    this.#unsubscribe = volume.subscribe((volume) => {
      this.#volume.gain.value = volumeToGain(volume);
    });
  }

  addInsert(effect: AudioNode | AudioInsert) {
    this.#inserts ??= [];
    this.#inserts.push(effect);
    this.#disconnect();
    this.#disconnect = connectSerial([
      this.input,
      ...this.#inserts,
      this.#volume,
      this.#options.destination,
    ]);
  }

  addEffect(
    name: string,
    effect: AudioNode | { input: AudioNode },
    mixValue: number
  ) {
    const mix = new GainNode(this.context);
    mix.gain.value = mixValue;
    const input = "input" in effect ? effect.input : effect;
    const disconnect = connectSerial([this.#volume, mix, input]);

    this.#sends ??= [];
    this.#sends.push({ name, mix, disconnect });
  }

  sendEffect(name: string, mix: number) {
    const send = this.#sends?.find((send) => send.name === name);
    if (send) {
      send.mix.gain.value = mix;
    } else {
      console.warn("Send bus not found: " + name);
    }
  }

  disconnect() {
    this.#disconnect();
    this.#unsubscribe();
    this.#sends?.forEach((send) => send.disconnect());
    this.#sends = undefined;
  }
}
