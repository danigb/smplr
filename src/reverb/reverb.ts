import { asConstructable } from "../smplr/as-constructable";
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

async function createDattorroReverbEffect(
  context: AudioContext,
): Promise<AudioWorkletNode | undefined> {
  if (!context.audioWorklet) {
    console.warn(
      "AudioWorklet not supported in this context. Reverb not available.",
    );
    return undefined;
  }
  let ready = init.get(context);
  if (!ready) {
    const blob = new Blob([PROCESSOR], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    ready = context.audioWorklet
      .addModule(url)
      .finally(() => URL.revokeObjectURL(url));
    init.set(context, ready);
  }
  await ready;

  const reverb = new AudioWorkletNode(context, "DattorroReverb", {
    outputChannelCount: [2],
  });
  return reverb;
}

class ReverbImpl {
  #effect: AudioWorkletNode | undefined;
  #ready: Promise<this>;
  public readonly input: AudioNode;
  #output: AudioNode;

  constructor(context: AudioContext) {
    this.input = context.createGain();
    this.#output = context.destination;
    this.#ready = createDattorroReverbEffect(context).then((reverb) => {
      if (reverb) {
        this.input.connect(reverb);
        reverb.connect(this.#output);
        this.#effect = reverb;
      }
      return this;
    });
  }

  get paramNames() {
    return PARAMS;
  }

  getParam(name: (typeof PARAMS)[number]): AudioParam | undefined {
    return this.#effect?.parameters.get(name);
  }

  get isReady(): boolean {
    return this.#effect !== undefined;
  }

  ready(): Promise<this> {
    return this.#ready;
  }

  connect(output: AudioNode) {
    // Record the target synchronously, then (re)route once the worklet is
    // ready. Works whether `connect` is called before or after `ready()`
    // resolves — calling it before no longer silently misroutes.
    this.#output = output;
    this.#ready.then(() => {
      if (this.#effect) {
        this.#effect.disconnect();
        this.#effect.connect(this.#output);
      }
    });
  }
}

export const Reverb = asConstructable(ReverbImpl);
export type Reverb = ReturnType<typeof Reverb>;
