import { Soundfont } from "smplr";
import { AudioContext as StandardizedAudioContext } from "standardized-audio-context";

function main() {
  const context = new StandardizedAudioContext() as unknown as AudioContext;
  const piano = new Soundfont(context, { instrument: "marimba" });

  const $button = document.getElementById("btn-test") as HTMLButtonElement;

  piano.load.then(() => {
    $button.disabled = false;
  });

  $button.addEventListener("click", () => {
    const now = context.currentTime;
    [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72].forEach((note, i) => {
      piano.start({ note, time: now + i * 0.3 });
    });
  });
}

main();
