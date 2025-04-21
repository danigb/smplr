# [smplr](https://github.com/danigb/smplr)

[![npm version](https://img.shields.io/npm/v/smplr)](https://www.npmjs.com/package/smplr)

> `smplr` is a collection of sampled instruments for Web Audio API ready to be used with no setup required.

Examples:

```js
import { Soundfont } from "smplr";

const context = new AudioContext();
const marimba = new Soundfont(context, { instrument: "marimba" });
marimba.start({ note: 60, velocity: 80 });
```

```js
import { DrumMachine } from "smplr";

const context = new AudioContext();
const dm = new DrumMachine(context);
dm.start({ note: "kick" });
```

```js
import { SplendidGrandPiano, Reverb } from "smplr";

const context = new AudioContext();
const piano = new SplendidGrandPiano(context);
piano.output.addEffect("reverb", new Reverb(context), 0.2);

piano.start({ note: "C4" });
```

See demo: https://danigb.github.io/smplr/

`smplr` is still under development and features are considered unstable until v 1.0

Read [CHANGELOG](https://github.com/danigb/smplr/blob/main/CHANGELOG.md) for changes.

#### Library goals

- No setup: specifically, all samples are online, so no need for a server.
- Easy to use: everything should be intuitive for non-experienced developers
- Decent sounding: uses high quality open source samples. For better or worse, it is sample based 🤷

## Setup

You can install the library with a package manager or use it directly by importing from the browser.

Samples are stored at https://github.com/smpldsnds and there is no need to download them. Kudos to all _samplerist_ 🙌

#### Using a package manger

Use npm or your favourite package manager to install the library to use it in your project:

```
npm i smplr
```

#### Usage from the browser

You can import directly from the browser. For example:

```html
<html>
  <body>
    <button id="btn">play</button>
  </body>
  <script type="module">
    import { SplendidGrandPiano } from "https://unpkg.com/smplr/dist/index.mjs"; // needs to be a url
    const context = new AudioContext(); // create the audio context
    const marimba = new SplendidGrandPiano(context); // create and load the instrument

    document.getElementById("btn").onclick = () => {
      context.resume(); // enable audio context after a user interaction
      marimba.start({ note: 60, velocity: 80 }); // play the note
    };
  </script>
</html>
```

The package needs to be serve as a url from a service like [unpkg](unpkg.com) or similar.

## Documentation

### Create and load an instrument

All instruments follows the same pattern: `new Instrument(context, options)`. For example:

```js
import { SplendidGrandPiano, Soundfont } from "smplr";

const context = new AudioContext();
const piano = new SplendidGrandPiano(context, { decayTime: 0.5 });
const marimba = new Soundfont(context, { instrument: "marimba" });
```

#### Wait for audio loading

You can start playing notes as soon as one audio is loaded. But if you want to wait for all of them, you can use the `load` property that returns a promise:

```js
piano.load.then(() => {
  // now the piano is fully loaded
});
```

Since the promise returns the instrument instance, you can create and wait in a single line:

```js
const piano = await new SplendidGrandPiano(context).load;
```

⚠️ In versions lower than 0.8.0 a `loaded()` function was exposed instead.

#### Shared configuration options

All instruments share some configuration options that are passed as second argument of the constructor. As it name implies, all fields are optional:

- `volume`: A number from 0 to 127 representing the instrument global volume. 100 by default
- `destination`: An `AudioNode` that is the output of the instrument. `AudioContext.destination` is used by default
- `volumeToGain`: a function to convert the volume to gain. It uses MIDI standard as default.
- `disableScheduler`: disable internal scheduler. `false` by default.
- `scheduleLookaheadMs`: the lookahead of the scheduler. If the start time of the note is less than current time plus this lookahead time, the note will be started. 200ms by default.
- `scheduleIntervalMs`: the interval of the scheduler. 50ms by default.
- `onStart`: a function that is called when starting a note. It receives the note started as parameter. Bear in mind that the time this function is called is not precise, and it's determined by lookahead.
- `onEnded`: a function that is called when the note ends. It receives the started note as parameter.

#### Usage with standardized-audio-context

This package should be compatible with [standardized-audio-context](https://github.com/chrisguttandin/standardized-audio-context):

```js
import { AudioContext } from "standardized-audio-context";

const context = new AudioContext();
const piano = new SplendidGrandPiano(context);
```

However, if you are using Typescript, you might need to "force cast" the types:

```ts
import { Soundfont } from "smplr";
import { AudioContext as StandardizedAudioContext } from "standardized-audio-context";

const context = new StandardizedAudioContext() as unknown as AudioContext;
const marimba = new Soundfont(context, { instrument: "marimba" });
```

In case you need to use the `Reverb` module (or any other module that needs `AudioWorkletNode`) you need to enforce to use the one from `standardized-audio-context` package. Here is how:

```ts
import {
  AudioWorkletNode,
  IAudioContext,
  AudioContext as StandardizedAudioContext,
} from "standardized-audio-context";

window.AudioWorkletNode = AudioWorkletNode as any;
const context = new StandardizedAudioContext() as unknown AudioContext;

// ... rest of the code
```

You can read more about this issue [here](https://github.com/chrisguttandin/standardized-audio-context/issues/897)

### Play

#### Start and stop notes

The `start` function accepts a bunch of options:

```js
piano.start({ note: "C4", velocity: 80, time: 5, duration: 1 });
```

The `velocity` is a number between 0 and 127 the represents at which velocity the key is pressed. The bigger the number, louder the sound. But `velocity` not only controls the loudness. In some instruments, it also affects the timbre.

The `start` function returns a `stop` function for the given note:

```js
const stopNote = piano.start({ note: 60 });
stopNote({ time: 10 });
```

Bear in mind that you may need to call [`context.resume()` before playing a note](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices#autoplay_policy)

Instruments have a global `stop` function that can be used to stop all notes:

```js
// This will stop all notes
piano.stop();
```

Or stop the specified one:

```js
// This will stop C4 note
piano.stop(60);
```

#### Schedule notes

You can schedule notes using `time` and `duration` properties. Both are measured in seconds. Time is the number of seconds since the AudioContext was created, like in `audioContext.currentTime`

For example, next example plays a C major arpeggio, one note per second:

```js
const now = context.currentTime;
["C4", "E4", "G4", "C5"].forEach((note, i) => {
  piano.start({ note, time: now + i, duration: 0.5 });
});
```

#### Looping

You can loop a note by using `loop`, `loopStart` and `loopEnd`:

```js
const sampler = new Sampler(audioContext, { duh: "duh-duh-ah.mp3" });
sampler.start({
  note: "duh"
  loop: true
  loopStart: 1.0,
  loopEnd: 9.0,
});
```

If `loop` is true but `loopStart` or `loopEnd` are not specified, 0 and total duration will be used by default, respectively.

#### Change volume

Instrument `output` attribute represents the main output of the instrument. `output.setVolume` method accepts a number where 0 means no volume, and 127 is max volume without amplification:

```js
piano.output.setVolume(80);
```

⚠️ `volume` is global to the instrument, but `velocity` is specific for each note.

#### Events

Two events are supported `onStart` and `onEnded`. Both callbacks will receive as parameter started note.

Events can be configured globally:

```js
const context = new AudioContext();
const sampler = new Sample(context, {
  onStart: (note) => {
    console.log(note.time, context.currentTime);
  },
});
```

or per note basis:

```js
piano.start({
  note: "C4",
  duration: 1,
  onEnded: () => {
    // will be called after 1 second
  },
});
```

Global callbacks will be invoked regardless of whether local events are defined.

⚠️ The invocation time of `onStart` is not exact. It triggers slightly before the actual start time and is influenced by the `scheduleLookaheadMs` parameter.

### Effects

#### Reverb

An packed version of [DattorroReverbNode](https://github.com/khoin/DattorroReverbNode) algorithmic reverb is included.

Use `output.addEffect(name, effect, mix)` to connect an effect using a send bus:

```js
import { Reverb, SplendidGrandPiano } from "smplr";
const reverb = new Reverb(context);
const piano = new SplendidGrandPiano(context, { volume });
piano.output.addEffect("reverb", reverb, 0.2);
```

To change the mix level, use `output.sendEffect(name, mix)`:

```js
piano.output.sendEffect("reverb", 0.5);
```

### Experimental features

#### Cache requests

If you use default samples, they are stored at github pages. Github rate limits the number of requests per second. That could be a problem, specially if you're using a development environment with hot reload (like most React frameworks).

If you want to cache samples on the browser you can use a `CacheStorage` object:

```ts
import { SplendidGrandPiano, CacheStorage } from "smplr";

const context = new AudioContext();
const storage = new CacheStorage();
// First time the instrument loads, will fetch the samples from http. Subsequent times from cache.
const piano = new SplendidGrandPiano(context, { storage });
```

⚠️ `CacheStorage` is based on [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache) and only works in secure environments that runs with `https`. Read your framework documentation for setup instructions. For example, in nextjs you can use https://www.npmjs.com/package/next-dev-https. For vite there's https://github.com/liuweiGL/vite-plugin-mkcert. Find the appropriate solution for your environment.

## Instruments

### Sampler

An audio buffer sampler. Pass a `buffers` object with the files to be load:

```js
import { Sampler } from "smplr";

const buffers = {
  kick: "https://smpldsnds.github.io/drum-machines/808-mini/kick.m4a",
  snare: "https://smpldsnds.github.io/drum-machines/808-mini/snare-1.m4a",
};
const sampler = new Sampler(new AudioContext(), { buffers });
```

And then use the name of the buffer as note name:

```js
sampler.start({ note: "kick" });
```

### Soundfont

A Soundfont player. By default it loads audio from Benjamin Gleitzman's package of
[pre-rendered sound fonts](https://github.com/gleitz/midi-js-soundfonts).

```js
import { Soundfont, getSoundfontNames, getSoundfontKits } from "smplr";

const marimba = new Soundfont(new AudioContext(), { instrument: "marimba" });
marimba.start({ note: "C4" });
```

It's intended to be a modern replacement of [soundfont-player](https://github.com/danigb/soundfont-player)

#### Soundfont instruments and kits

Use `getSoundfontNames` to get all available instrument names and `getSoundfontKits` to get kit names.

There are two kits available: `MusyngKite` or `FluidR3_GM`. The first one is used by default: it sounds better but samples weights more.

```js
const marimba = new Soundfont(context, {
  instrument: "clavinet",
  kit: "FluidR3_GM", // "MusyngKite" is used by default if not specified
});
```

Alternatively, you can pass your custom url as the instrument. In that case, the `kit` is ignored:

```js
const marimba = new Soundfont(context, {
  instrumentUrl:
    "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/marimba-mp3.js",
});
```

#### Soundfont sustained notes

You can enable note looping to make note names indefinitely long by loading loop data:

```js
const marimba = new Soundfont(context, {
  instrument: "cello",
  loadLoopData: true,
});
```

⚠️ This feature is still experimental and can produces clicks on lot of instruments.

### SplendidGrandPiano

A sampled acoustic piano. It uses Steinway samples with 4 velocity groups from
[SplendidGrandPiano](https://github.com/sfzinstruments/SplendidGrandPiano)

```js
import { SplendidGrandPiano } from "smplr";

const piano = new SplendidGrandPiano(new AudioContext());

piano.start({ note: "C4" });
```

#### SplendidGrandPiano constructor

The second argument of the constructor accepts the following options:

- `baseUrl`:
- `detune`: global detune in cents (0 if not specified)
- `velocity`: default velocity (100 if not specified)
- `volume`: default volume (100 if not specified)
- `decayTime`: default decay time (0.5 seconds)
- `notesToLoad`: an object with the following shape: `{ notes: number[], velocityRange: [number, number]}` to specify a subset of notes to load

Example:

```ts
const piano = new SplendidGrandPiano(context, {
  detune: -20,
  volume: 80,
  notesToLoad: {
    notes: [60],
    velocityRange: [1, 127],
  },
});
```

### Electric Piano

A sampled electric pianos. Samples from https://github.com/sfzinstruments/GregSullivan.E-Pianos

```js
import { ElectricPiano, getElectricPianoNames } from "smplr";

const instruments = getElectricPianoNames(); // => ["CP80", "PianetT", "WurlitzerEP200"]

const epiano = new ElectricPiano(new AudioContext(), {
  instrument: "PianetT",
});

epiano.start({ note: "C4" });

// Includes a (basic) tremolo effect:
epiano.tremolo.level(30);
```

Available instruments:

- `CP80`: Yamaha CP80 Electric Grand Piano v1.3 (29-Sep-2004)
- `PianetT`: Hohner Pianet T (type 2) v1.3 (24-Sep-2004)
- `WurlitzerEP200`: Wurlitzer EP200 Electric Piano v1.1 (16-May-1999)

### Mallets

Samples from [The Versilian Community Sample Library](https://github.com/sgossner/VCSL)

```js
import { Mallet, getMalletNames } from "smplr";

const instruments = getMalletNames();

const mallet = new Mallet(new AudioContext(), {
  instrument: instruments[0],
});
```

### Mellotron

Samples from [archive.org](https://archive.org/details/mellotron-archive-cd-rom-nki-wav.-7z)

```js
import { Mellotron, getMellotronNames } from "smplr";

const instruments = getMellotronNames();

const mallet = new Mellotron(new AudioContext(), {
  instrument: instruments[0],
});
```

### Drum Machines

Sampled drum machines. Samples from different sources:

```js
import { DrumMachine, getDrumMachineNames } from "smplr";

const instruments = getDrumMachineNames();

const context = new AudioContext();
const drums = new DrumMachine(context, { instrument: "TR-808" });
drums.start({ note: "kick" });

// Drum samples are grouped and can have sample variations:
drums.getSampleNames(); // => ['kick-1', 'kick-2', 'snare-1', 'snare-2', ...]
drums.getGroupNames(); // => ['kick', 'snare']
drums.getSampleNamesForGroup("kick") => // => ['kick-1', 'kick-2']

// You can trigger samples by group name or specific sample
drums.start("kick"); // Play the first sample of the group
drums.start("kick-1"); // Play this specific sample
```

### Smolken double bass

```js
import { Smolken, getSmolkenNames } from "smplr";

const instruments = getSmolkenNames(); // => Arco, Pizzicato & Switched

// Create an instrument
const context = new AudioContext();
const doubleBass = await new Smolken(context, { instrument: "Arco" }).load;
```

### Versilian

Versilian is a sample capable of using the [Versilian Community Sample Library](https://github.com/sgossner/VCSL).

⚠️ Not all features are implemented. Some instruments may sound incorrect ⚠️

```js
import { Versilian, getVersilianInstruments } from "smplr";

// getVersilianInstruments returns a Promise
const instrumentNames = await getVersilianInstruments();

const context = new AudioContext();
const sampler = new Versilian(context, { instrument: instrumentNames[0] });
```

### Soundfont2Sampler

Sampler capable of reading .sf2 files directly:

```ts
import { Soundfont2Sampler } from "smplr";
import { SoundFont2 } from "soundfont2";

const context = new AudioContext();
const sampler = new Soundfont2Sampler(context, {
  url: "https://smpldsnds.github.io/soundfonts/soundfonts/galaxy-electric-pianos.sf2",
  createSoundfont: (data) => new SoundFont2(data),
});

sampler.load.then(() => {
  // list all available instruments for the soundfont
  console.log(sampler.instrumentNames);

  // load the first available instrument
  sampler.loadInstrument(sampler.instrumentNames[0]);
});
```

Still limited support. API may vary.

## License

MIT License
