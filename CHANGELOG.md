# smplr

## 0.16.x

#### DrumMachine sample groups

DrumMachines group different samples with same prefix under the same group. For example `tom-1.ogg` and `tom-2.ogg` forms the `tom` group:

```js
const drums = new DrumMachine(context, { instrument: "TR-808" });
drum.getSampleNames(); // => ['kick-1', 'kick-2', 'snare-1', 'snare-2', ...]
drum.getGroupNames(); // => ['kick', 'snare']
drum.getSampleNamesForGroup('kick') => // => ['kick-1', 'kick-2']
```

**Deprecations:**

- `drum.sampleNames` is deprecated in favour of `drum.getSampleNames()` or `drum.getGroupNames()`
- `drum.getVariations` is now called `drum.getSampleNamesForGroup`

#### Bug fix: SampleGrandPiano stop note

Now you can pass a note name to `stop` method of grand piano:

```js
piano.start("C4");

piano.stop(60); // This worked previously
piano.stop("C4"); // This now works
```

#### Bug fix: Soundfont configuration

Previously `kit` config parameter was silently ignored unless `instrumentUrl` was provided. This is now fixed. See https://github.com/danigb/smplr/issues/103

## 0.15.x

#### Disable scheduler with `disableScheduler` option

By default the smplr player has a custom scheduler that helps when playing lot of notes at the same time. This scheduler can be disabled with `disableScheduler` option:

```ts
const context = new AudioContext();
const piano = new SplendidGrandPiano(context, {
  disableScheduler: true,
});
```

This is required to render things in an OfflineAudioContext.

## 0.14.x

#### Load soundfont files directly via Soundfont2 (385d492)

Now is possible to load soundfont files directly thanks to [soundfont2](https://www.npmjs.com/package/soundfont2) package.

First you need to add the dependency to the project:

```bash
npm i soundfont2
```

Then, use the new Soundfont2Sampler class:

```ts
import { Soundfont2Sampler } from "smplr";
import { SoundFont2 } from "soundfont2";

const context = new AudioContext();
const sampler = Soundfont2Sampler(context, {
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

Support is still very limited. Lot of soundfont features are still not implemented, however looping seems to work quite well (read #78)

## 0.13.x

#### DrumMachines accept a DrumMachineInstrument as source

Previously you could use a instrument name or a instrument url to load a DrumMachine.

Now you can pass the DrumMachineInstrument object directly to the constructor:

```js
const context = new AudioContext();
const drums = new DrumMachine(context, {
  instrument: {
    baseUrl: "https://smpldsnds.github.io/drum-machines/roland-cr-8000/",
    name: "Roland-CR-8000",
    samples: [
      "hihat-closed",
      "hihat-open",
      "kick",
      "snare",
      "tom-high",
      "tom-low",
    ],
    formats: ["ogg", "m4a"],
  },
});
```

- Fix: sample rate used to calculate soundfont loop data
- DrumMachine uses https://github.com/smpldsnds/drum-machines as source of samples
- Fix: `detune` param on `start` method

## 0.12.x

- 0.12.0 SplendidGrandPiano supports loading a subset of notes
- 0.12.1 Fix npm publish problem
- 0.12.2 Fix non-integer midi in 1 note length regions (#61)

## 0.11.x

- 0.11.3 Add support for standardized audio context
- 0.11.2 Resolved an issue in the sfz sampler that prevented any sound from being played when the velocity was not specified.
- 0.11.1 Fix onStart callback when using `start` on Soundfont
- Add `onStart` sample event
- Add `onStart` and `onEnded` global events

## 0.10.x

- 0.10.3 - Fix output connection
- 0.10.2 - Remove console.log
- 0.10.1 - Fix onEnded not working

## 0.10.0

- Feature: Versilian VCSL instrument (not fully implemented)

## 0.9.0

- Feature: Support for SFZ file parsing
- Feature: New Smolken double bass instrument

## 0.8.1

- Fix: soundfont.loop returns this
- Improvement: Soundfont uses group abstraction. Simplify code

## 0.8.0

- Feature: New Mellotron instrument
- Deprecation: : use `load` property instead of `loaded()` function

## 0.7.0

- Feature: Soundfont can play looped instruments using new loadLoopData option
- Feature: New sample player accepts a very large number of notes
- Feature: `loop`, `loopStart` and `loopEnd` has been added as sample start options
- Fix: Can't disconnect a player or channel twice

## 0.6.1

- Fix: error with HttpStorage fetch binding

## 0.6.0

- Feature: Add `CacheStorage` object for caching http requests

## 0.5.1

- Fix: Ensure `options` is optional when possible

## 0.5.0

- Feature: Add `onEnded` property to the start note object

## 0.4.3

- Fix: Rename `getSoundfontInstrumentNames` to `getSoundfontNames` to keep naming consistency

## 0.4.2

- Fix: Ensure mp3 Soundfonts are loaded in Safari

## 0.4.1

- Fix: Accept note name in SplendidGrandPiano
- Fix: Show a console.warning if the buffer is not found

## 0.4.0

- Feature: Add DrumMachine instrument

## 0.3.0

Full rewrite. Samples stored at https://github.com/danigb/samples
