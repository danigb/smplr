import { AudioInsert } from "./player/connect";
import { Subscribe } from "./player/signals";

// @private
export function createTremolo(
  context: AudioContext,
  depth: Subscribe<number>
): AudioInsert {
  const input = context.createGain();
  const output = context.createGain();

  // force mono sources to be stereo
  input.channelCount = 2;
  input.channelCountMode = "explicit";

  const splitter = context.createChannelSplitter(2);
  const ampL = context.createGain();
  const ampR = context.createGain();
  const merger = context.createChannelMerger(2);

  const lfoL = context.createOscillator();
  lfoL.type = "sine";
  lfoL.frequency.value = 1;
  lfoL.start();
  const lfoLAmp = context.createGain();
  const lfoR = context.createOscillator();
  lfoR.type = "sine";
  lfoR.frequency.value = 1.1;
  lfoR.start();
  const lfoRAmp = context.createGain();

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
