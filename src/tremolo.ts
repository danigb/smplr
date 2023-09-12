import { AudioInsert } from "./player/connect";
import { Subscribe } from "./player/signals";

// @private
export function createTremolo(
  context: AudioContext,
  depth: Subscribe<number>
): AudioInsert {
  const input = new GainNode(context);
  const output = new GainNode(context);

  // force mono sources to be stereo
  input.channelCount = 2;
  input.channelCountMode = "explicit";

  const splitter = new ChannelSplitterNode(context, { numberOfOutputs: 2 });
  const ampL = new GainNode(context);
  const ampR = new GainNode(context);
  const merger = new ChannelMergerNode(context, { numberOfInputs: 2 });

  const lfoL = new OscillatorNode(context, {
    type: "sine",
    frequency: 1,
  });
  lfoL.start();
  const lfoLAmp = new GainNode(context);
  const lfoR = new OscillatorNode(context, {
    type: "sine",
    frequency: 1.1,
  });
  lfoR.start();
  const lfoRAmp = new GainNode(context);

  input.connect(splitter);
  splitter.connect(ampL, 0);
  splitter.connect(ampR, 1);
  ampL.connect(merger, 0, 0);
  ampR.connect(merger, 0, 1);
  lfoL.connect(lfoLAmp);
  lfoLAmp.connect(ampL.gain);
  lfoR.connect(lfoRAmp);
  lfoRAmp.connect(ampR.gain);
  merger.connect(output);

  const unsubscribe = depth((depth) => {
    lfoLAmp.gain.value = depth;
    lfoRAmp.gain.value = depth;
  });

  input.disconnect = () => {
    unsubscribe();
    lfoL.stop();
    lfoR.stop();
    input.disconnect(splitter);
    splitter.disconnect(ampL, 0);
    splitter.disconnect(ampR, 1);
    ampL.disconnect(merger, 0, 0);
    ampR.disconnect(merger, 0, 1);
    lfoL.disconnect(ampL);
    lfoR.disconnect(ampR);
    merger.disconnect(output);
  };

  return { input, output };
}
