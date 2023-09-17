import { AudioInsert, connectSerial } from "./connect";
import { createControl } from "./signals";
import { midiVelToGain } from "./volume";

export type ChannelOptions = {
  destination: AudioNode;
  volume: number;
  volumeToGain: (volume: number) => number;
};

export type OutputChannel = Omit<Channel, "input">;

type Send = {
  name: string;
  mix: GainNode;
  disconnect: () => void;
};

/**
 * An output channel with audio effects
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
  #disconnected = false;

  constructor(
    public readonly context: BaseAudioContext,
    options: Partial<ChannelOptions>
  ) {
    this.#options = {
      destination: context.destination,
      volume: 100,
      volumeToGain: midiVelToGain,
      ...options,
    };

    this.input = context.createGain();
    this.#volume = context.createGain();

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
    if (this.#disconnected) {
      throw Error("Can't add insert to disconnected channel");
    }
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
    if (this.#disconnected) {
      throw Error("Can't add effect to disconnected channel");
    }
    const mix = new GainNode(this.context);
    mix.gain.value = mixValue;
    const input = "input" in effect ? effect.input : effect;
    const disconnect = connectSerial([this.#volume, mix, input]);

    this.#sends ??= [];
    this.#sends.push({ name, mix, disconnect });
  }

  sendEffect(name: string, mix: number) {
    if (this.#disconnected) {
      throw Error("Can't send effect to disconnected channel");
    }

    const send = this.#sends?.find((send) => send.name === name);
    if (send) {
      send.mix.gain.value = mix;
    } else {
      console.warn("Send bus not found: " + name);
    }
  }

  disconnect() {
    if (this.#disconnected) return;
    this.#disconnected = true;
    this.#disconnect();
    this.#unsubscribe();
    this.#sends?.forEach((send) => send.disconnect());
    this.#sends = undefined;
  }
}
