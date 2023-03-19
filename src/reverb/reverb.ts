import { PROCESSOR } from "./processor.min";

const PARAMS = [
  "preDelay",
  "bandwidth",
  "inputDiffusion1",
  "inputDiffusion2",
  "decay",
  "decayDiffusion1",
  "decayDiffusion2",
  "damping",
  "excursionRate",
  "excursionDepth",
  "wet",
  "dry",
] as const;

const init = new WeakMap<AudioContext, Promise<void>>();

async function createDattorroReverbEffect(context: AudioContext) {
  let ready = init.get(context);
  if (!ready) {
    const blob = new Blob([PROCESSOR], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    ready = context.audioWorklet.addModule(url);
    init.set(context, ready);
  }
  await ready;

  const reverb = new AudioWorkletNode(context, "DattorroReverb", {
    outputChannelCount: [2],
  });
  return reverb;
}

export class Reverb {
  #effect: AudioWorkletNode | undefined;
  #ready: Promise<this>;
  public readonly input: AudioNode;
  #output: AudioNode;

  constructor(context: AudioContext) {
    this.input = context.createGain();
    this.#output = context.destination;
    this.#ready = createDattorroReverbEffect(context).then((reverb) => {
      this.input.connect(reverb);
      reverb.connect(this.#output);
      this.#effect = reverb;
      return this;
    });
  }

  get paramNames() {
    return PARAMS;
  }

  getParam(name: (typeof PARAMS)[number]): AudioParam | undefined {
    return this.#effect?.parameters.get("preDelay");
  }

  get isReady(): boolean {
    return this.#effect !== undefined;
  }

  ready(): Promise<this> {
    return this.#ready;
  }

  connect(output: AudioNode) {
    if (this.#effect) {
      this.#effect.disconnect(this.#output);
      this.#effect.connect(output);
    }
    this.#output = output;
  }
}
