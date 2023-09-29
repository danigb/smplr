import { SplendidGrandPiano } from "https://unpkg.com/smplr/dist/index.mjs";

const NUMBER_OF_NOTES = 2000;

const audioContext = new AudioContext();

// Piano
const piano = new SplendidGrandPiano(audioContext, {});
piano.loaded().then(() => {
  document.getElementById("btn-piano").disabled = false;
  document.getElementById("btn-scheduler").disabled = false;
});

// Sample
const sampleUrl =
  "https://danigb.github.io/samples/splendid-grand-piano/PP-C4.ogg";
let sampleBuffer;
let stopSamples;
fetch(sampleUrl)
  .then((res) => res.arrayBuffer())
  .then((buffer) => audioContext.decodeAudioData(buffer))
  .then((audioBuffer) => {
    sampleBuffer = audioBuffer;
    document.getElementById("btn-test").disabled = false;
  });

function Scheduler(sampler) {
  let queue = [];

  function enqueue(item) {
    const last = queue[queue.length - 1];
    if (!last || (last && last.time < item.time)) {
      queue.push(item);
      return;
    }

    let left = 0;
    let right = queue.length - 1;
    let index = queue.length;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (item.time - queue[mid] < 0) {
        index = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    queue.splice(index, 0, item);
  }

  setInterval(() => {
    let note = queue[0];
    while (note && note.time < audioContext.currentTime + 1) {
      queue.shift();
      sampler.start(note);
      note = queue[0];
    }
  }, 100);

  function start(note) {
    if (note.time < audioContext.currentTime + 1) {
      sampler.start(note);
    } else {
      enqueue(note);
    }
  }

  function stop() {
    queue = [];
    sampler.stop();
  }
  return { start, stop };
}
const scheduler = Scheduler(piano, {
  onStart: console.log,
  onEnded: console.warn,
});

document.getElementById("btn-test").addEventListener("click", function () {
  if (stopSamples) return;
  document.getElementById("btn-test").disabled = true;
  audioContext.resume().then(() => {
    let sources = [];
    const now = audioContext.currentTime;
    for (let i = 0; i < NUMBER_OF_NOTES; i++) {
      const source = audioContext.createBufferSource();
      source.buffer = sampleBuffer;
      source.connect(audioContext.destination);
      source.start(now + i * 0.1);
      sources.push(source);
    }
    stopSamples = () => {
      sources.forEach((source) => source.stop());
      sources = undefined;
      stopSamples = undefined;
      document.getElementById("btn-test").disabled = false;
    };
  });
});

document.getElementById("btn-piano").addEventListener("click", function () {
  audioContext.resume().then(() => {
    const now = audioContext.currentTime;
    for (let i = 0; i < NUMBER_OF_NOTES; i++) {
      piano.start({
        note: (i % 60) + 20,
        time: now + 0.1 * i,
        duration: 0.2,
        velocity: Math.floor(Math.random() * 100) + 20,
      });
    }
    document.getElementById("btn-piano").disabled = true;
  });
});

document.getElementById("btn-scheduler").addEventListener("click", function () {
  audioContext.resume().then(() => {
    const now = audioContext.currentTime;
    for (let i = 0; i < NUMBER_OF_NOTES; i++) {
      scheduler.start({
        note: (i % 60) + 20,
        time: now + 0.1 * i,
        duration: 0.2,
        velocity: Math.floor(Math.random() * 100) + 20,
      });
    }
    document.getElementById("btn-scheduler").disabled = true;
  });
});

document.getElementById("btn-stop").addEventListener("click", function () {
  if (stopSamples) stopSamples();
  piano.stop();
  scheduler.stop();
  document.getElementById("btn-test").disabled = false;
  document.getElementById("btn-piano").disabled = false;
  document.getElementById("btn-scheduler").disabled = false;
});
