import { AudioInsert, connectSerial } from "./connect";
import { Control, createControl } from "./signals";
import { midiVelToGain } from "./volume";

export type ChannelConfig = {
  destination: AudioNode;
  volume: number;
  volumeToGain: (volume: number) => number;
  pan?: number;
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
  public readonly input: AudioNode;

  #volumeControl: Control<number>;
  #volumeGain: GainNode;
  #panner: StereoPannerNode;
  #sends?: Send[];
  #inserts?: (AudioNode | AudioInsert)[];
  #disconnect: () => void;
  #unsubscribe: () => void;
  #config: Readonly<ChannelConfig>;
  #disconnected = false;

  constructor(
    public readonly context: BaseAudioContext,
    options?: Partial<ChannelConfig>
  ) {
    this.#config = {
      destination: options?.destination ?? context.destination,
      volume: options?.volume ?? 100,
      volumeToGain: options?.volumeToGain ?? midiVelToGain,
      pan: options?.pan ?? 0,
    };

    this.input = context.createGain();
    this.#volumeGain = context.createGain();
    this.#panner = context.createStereoPanner();
    this.#panner.pan.value = this.#config.pan!;

    this.#disconnect = connectSerial([
      this.input,
      this.#volumeGain,
      this.#panner,
      this.#config.destination,
    ]);

    this.#volumeControl = createControl(this.#config.volume);
    this.#unsubscribe = this.#volumeControl.subscribe((volume) => {
      this.#volumeGain.gain.value = this.#config.volumeToGain(volume);
    });
  }

  get volume(): number {
    return this.#volumeControl.get();
  }

  set volume(value: number) {
    this.#volumeControl.set(value);
  }

  /** @deprecated Use `output.volume = value` instead. */
  setVolume(vol: number) {
    console.warn("smplr: output.setVolume() is deprecated. Use `output.volume = value` instead.");
    this.volume = vol;
  }

  get pan(): number {
    return this.#panner.pan.value;
  }

  set pan(value: number) {
    this.#panner.pan.value = value;
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
      this.#volumeGain,
      this.#panner,
      this.#config.destination,
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
    const mix = this.context.createGain();
    mix.gain.value = mixValue;
    const input = "input" in effect ? effect.input : effect;
    const disconnect = connectSerial([this.#volumeGain, mix, input]);

    this.#sends ??= [];
    this.#sends.push({ name, mix, disconnect });
  }

  setEffectMix(name: string, mix: number) {
    if (this.#disconnected) {
      throw Error("Can't set effect mix on disconnected channel");
    }

    const send = this.#sends?.find((send) => send.name === name);
    if (send) {
      send.mix.gain.value = mix;
    } else {
      console.warn("Send bus not found: " + name);
    }
  }

  /** @deprecated Use `output.setEffectMix(name, mix)` instead. */
  sendEffect(name: string, mix: number) {
    console.warn("smplr: output.sendEffect() is deprecated. Use `output.setEffectMix(name, mix)` instead.");
    this.setEffectMix(name, mix);
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
