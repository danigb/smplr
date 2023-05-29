# smplr

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

#### Library goals

- No setup: specifically, all samples are online, so no need for a server.
- Easy to use: everything should be intuitive for non-experienced developers
- Decent sounding: uses high quality open source samples. For better or worse, it is sample based 🤷

## Install

Install with npm or your favourite package manager:

```
npm i smplr
```

Samples are published at: https://github.com/danigb/samples

`smplr` is still under development and features are considered unstable. See [CHANGELOG](https://github.com/danigb/smplr/blob/main/CHANGELOG.md) for changes.

## Documentation

### Create an instrument

All instruments follows the same pattern: `new Instrument(context, options?)`. For example:

```js
import { SplendidGrandPiano, Soundfont } from "smplr";

const context = new AudioContext();
const piano = new SplendidGrandPiano(context, { decayTime: 0.5 });
const marimba = new Soundfont(context, { instrument: "marimba" });
```

#### Wait for audio loading

You can start playing notes as soon as one audio is loaded. But if you want to wait for all of them, you can use the `loaded()` function that returns a promise:

```js
piano.loaded().then(() => {
  // now the piano is fully loaded
});
```

Since the promise returns the instrument instance, you can create and wait in a single line:

```js
const piano = await new SplendidGrandPiano(context).loaded();
```

#### Cache requests

[Experimental]

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

You can schedule notes using `time` and `duration` properties. Both are measured in seconds, and time is the number of seconds since the AudioContext was created.

For example, next example plays a C major arpeggio, one note per second:

```js
const now = context.currentTime;
["C4", "E4", "G4", "C5"].forEach((note, i) => {
  piano.start({ note, time: now + i, duration: 0.5 });
});
```

#### onEnded event

You can add a `onEnded` callback that will be invoked when the note ends:

```js
piano.start({
  note: "C4",
  duration: 1,
  onEnded: () => {
    // will be called after 1 second
  },
});
```

The callback will receive as parameter the same object you pass to the `start` function;

### Change volume

Instrument `output` attribute represents the main output of the instrument. `output.setVolume` method accepts a number where 0 means no volume, and 127 is max volume without amplification:

```js
piano.output.setVolume(80);
```

Bear in mind that `volume` is global to the instrument, but `velocity` is specific for each note.

### Effects

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
  instrument:
    "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/marimba-mp3.js",
});
```

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

### Drum Machines

Sampled drum machines. Samples from different sources:

```js
import { DrumMachine, getDrumMachineNames } from "smplr";

const instruments = getDrumMachineNames();

const context = new AudioContext();
const drums = new DrumMachine(context, { instrument: "TR-808" });
drums.start({ note: "kick" });

// Drum samples could have variations:
const now = context.currentTime;
drums.getVariations("kick").forEach((variation, index) => {
  drums.start({ note: variation, time: now + index });
});
```

## License

MIT License
