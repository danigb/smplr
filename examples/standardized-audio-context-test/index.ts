import { Reverb, Soundfont } from "smplr";
import {
  AudioWorkletNode,
  AudioContext as StandardizedAudioContext,
} from "standardized-audio-context";

function main() {
  window.AudioWorkletNode = AudioWorkletNode as any;
  const context = new StandardizedAudioContext() as unknown as AudioContext;
  const instrument = new Soundfont(context, { instrument: "marimba" });
  instrument.output.addEffect("reverb", new Reverb(context), 0.9);

  const $button = document.getElementById("btn-test") as HTMLButtonElement;

  instrument.load.then(() => {
    $button.disabled = false;
  });

  $button.addEventListener("click", () => {
    const now = context.currentTime;
    [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72].forEach((note, i) => {
      instrument.start({ note, time: now + i * 0.3 });
    });
  });
}

main();
