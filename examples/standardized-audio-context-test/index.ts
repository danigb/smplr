import { SplendidGrandPiano } from "smplr";
import { AudioContext } from "standardized-audio-context";

function main() {
  const context = new AudioContext();
  const piano = new SplendidGrandPiano(context);

  console.log("Hello world!");
}

main();
