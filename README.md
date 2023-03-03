# smplr

[![npm version](https://img.shields.io/npm/v/smplr)](https://www.npmjs.com/package/smplr)

> `smplr` is a collection of sampled instruments for Web Audio API ready to be used with no setup required.

Example:

```js
import { SplendidGrandPiano, Soundfont, Reverb } from "smplr";

const context = new AudioContext();
const piano = new SplendidGrandPiano(context);
piano.start({ note: "C4" });

const marimba = new Soundfont(context, { instrument: "marimba" });
marimba.start({ note: 60, velocity: 80 });

// Optionally, add reverb...
piano.output.addEffect("reverb", new Reverb(context), 0.1);
// ... and change how much
piano.output.sendEffect("reverb", 0.2);
```

See demo: https://danigb.github.io/smplr/

Install with npm or your favourite package manager:

```
npm i smplr
```

Samples are published at: https://github.com/danigb/samples

## Documentation

### Create an instrument

All instruments follows the same pattern: `new Instrument(context, options)`. For example:

```js
import { SplendidGrandPiano, Soundfont } from "smplr";

const context = new AudioContext();
const piano = new SplendidGrandPiano(context, { decayTime: 0.5 });
const marimba = new Soundfont(context, { instrument: "marimba" });
```

### Wait for audio loading

You can start playing notes as soon as one audio is loaded. But if you want to wait for all of them, you can use `loaded()` function that returns a promise:

```js
piano.loaded().then(() => {
  // now the piano is fully loaded
});
```

Since the promise returns the instrument instance, you can create and wait in a single line:

```js
const piano = await new SplendidGrandPiano(context).loaded();
```

### Start and stop notes

The `start` function accepts a bunch of options:

```js
piano.start({ note: "C4", velocity: 80, time: 5, duration: 1 });
```

The `velocity` is a number between 0 and 128 the represents at which velocity the key is pressed. The bigger the number, louder the sound. But `velocity` not only controls the loudness. In some instruments, it also affects the timbre.

The `start` function returns a `stop` function for the given note:

```js
const stopNote = piano.start({ note: 60 });
stopNote({ time: 10 });
```

Bear in mind that you may need to call [`context.resume()` before playing a note](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices#autoplay_policy)

### Schedule notes

You can schedule notes using `time` and `duration` properties:

```js
const now = context.currentTime;
[60, 62, 64, 65, 67].forEach((note, i) => {
  piano.start({ note, time: now + i, duration: 0.5 });
});
```

### Stop all notes

Instruments have a global `stop` function that stops all notes:

```js
button.onclick = () => piano.stop();
```

It can stop only the specified note:

```js
piano.stop(60);
```

### Change volume

`setVolume` uses a scale where 0 means no volume, and 128 is max volume without amplification:

```js
piano.setVolume(80);
```

Bear in mind that `volume` is global to the instrument, but `velocity` is specific for each note.

### Effects

An packed version of [DattorroReverbNode](https://github.com/khoin/DattorroReverbNode) algorithmic reverb is included.

Use `output.addEffect(name, effect, mix)` to create connect an effect using a send bus:

```js
import { Reverb, SplendidGrandPiano } from "smplr";
const reverb = new Reverb(context);
const piano = new SplendidGrandPiano(context, { volume });
piano.output.addEffect("reverb", reverb, 0.2);
```

Use `output.sendEffect(name, mix)` to change the mix level:

```js
piano.output.sendEffect("reverb", 0.5);
```

## Instruments

### Sampler

An audio buffer sampler.

```js
import { Sampler } from "smplr";

const samples = {
  kick: "https://danigb.github.io/samples/drum-machines/808-mini/kick.m4a",
  snare: "https://danigb.github.io/samples/drum-machines/808-mini/snare-1.m4a",
};
const sampler = new Sampler(new AudioContext(), { samples });
sampler.start({ note: "kick" });
```

### Soundfont

A Soundfont player. By default it loads audio from Benjamin Gleitzman's package of
[pre-rendered sound fonts](https://github.com/gleitz/midi-js-soundfonts).

```js
import { Soundfont } from "smplr";

const marimba = new Soundfont(new AudioContext(), "marimba");
marimba.start({ note: "C4" });
```

It's intended to be a modern replacement of [soundfont-player](https://github.com/danigb/soundfont-player)

### Piano

A sampled acoustic piano. It uses Steinway samples with 4 velocity layers from
[SplendidGrandPiano](https://github.com/sfzinstruments/SplendidGrandPiano)

```js
import { SplendidGrandPiano } from "smplr";

const piano = new SplendidGrandPiano(new AudioContext());

piano.start({ note: "C4" });
```

### Electric Piano

A sampled electric pianos. Samples from https://github.com/sfzinstruments/GregSullivan.E-Pianos

```js
import { ElectricPiano } from "smplr";

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

### Drum Machines

Sampled drum machines. Samples from different sources:

```js
import { DrumMachine, getDrumMachineNames } from "smplr";

const instruments = getDrumMachineNames();

const drums = new DrumMachine(new AudioContext(), { instrument: "TR-808" });
```

## License

MIT License
