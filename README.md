# [smplr](https://github.com/danigb/smplr)

[![npm version](https://img.shields.io/npm/v/smplr)](https://www.npmjs.com/package/smplr)

> `smplr` is a collection of sampled instruments for Web Audio API ready to be used with no setup required.

## Quick start

**Play a note from a General MIDI soundfont:**

```js
import { Soundfont } from "smplr";

const context = new AudioContext();
const marimba = Soundfont(context, { instrument: "marimba" });
marimba.start({ note: 60, velocity: 80 });
```

**Sequence a beat with a drum machine and a piano on the same clock:**

```js
import { Sequencer, SplendidGrandPiano, DrumMachine } from "smplr";

const context = new AudioContext();
const piano = SplendidGrandPiano(context);
const drums = DrumMachine(context, { instrument: "TR-808" });

const seq = Sequencer(context, { bpm: 110, loop: true });
seq.addTrack(piano, [
  { note: "C4", at: "1:1", duration: "4n" },
  { note: "E4", at: "1:2", duration: "4n" },
  { note: "G4", at: "1:3", duration: "4n" },
]);
seq.addTrack(drums, [
  { note: "kick", at: "1:1" },
  { note: "snare", at: "1:2" },
  { note: "kick", at: "1:3" },
  { note: "snare", at: "1:4" },
]);
seq.start();
```

**Render an arpeggio with reverb to a WAV file — offline, no speakers needed:**

```js
import { SplendidGrandPiano, Reverb, renderOffline } from "smplr";

const wav = await renderOffline(async (context) => {
  const piano = await SplendidGrandPiano(context).load;
  piano.output.addEffect("reverb", Reverb(context), 0.3);
  ["C4", "E4", "G4", "C5"].forEach((note, i) => {
    piano.start({ note, time: i * 0.4, duration: 0.4 });
  });
});
wav.downloadWav("arpeggio.wav");
```

See demo: https://danigb.github.io/smplr/

#### Library goals

- No setup: specifically, all samples are online, so no need for a server.
- Easy to use: everything should be intuitive for non-experienced developers
- Decent sounding: uses high quality open source samples. For better or worse, it is sample based 🤷

## Installation

You can install the library with a package manager or use it directly by importing from the browser.

Samples are stored at https://github.com/smpldsnds and there is no need to download them. Kudos to all _samplerist_ 🙌

#### Using a package manager

Install with npm or your favourite package manager:

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
    const piano = SplendidGrandPiano(context); // create and load the instrument

    document.getElementById("btn").onclick = () => {
      context.resume(); // enable audio context after a user interaction
      piano.start({ note: 60, velocity: 80 }); // play the note
    };
  </script>
</html>
```

The package needs to be served as a URL from a service like [unpkg](https://unpkg.com) or similar.

## Available instruments

`smplr` ships eleven instruments out of the box. Pick one and jump to its section in the [Instrument reference](#instrument-reference) for setup details.

| Instrument                                  | Description                               | Names helper                 |
| ------------------------------------------- | ----------------------------------------- | ---------------------------- |
| [`Sampler`](#sampler)                       | Your own buffers or SFZ-style preset      | —                            |
| [`Soundfont`](#soundfont)                   | General MIDI soundfonts                   | `getSoundfontNames()`        |
| [`SplendidGrandPiano`](#splendidgrandpiano) | Sampled Steinway grand, 4 velocity layers | —                            |
| [`ElectricPiano`](#electric-piano)          | CP80, PianetT, Wurlitzer, TX81Z           | `getElectricPianoNames()`    |
| [`DrumMachine`](#drum-machines)             | Classic drum machines (TR-808, …)         | `getDrumMachineNames()`      |
| [`DrumAbuse`](#drumabuse)                   | ~210 machines (Synthabuse collection)     | `getDrumAbuseMachineNames()` |
| [`Mallet`](#mallets)                        | VCSL mallets                              | `getMalletNames()`           |
| [`Mellotron`](#mellotron)                   | Mellotron archive samples                 | `getMellotronNames()`        |
| [`Smolken`](#smolken-double-bass)           | Smolken double bass (Arco/Pizz/Switched)  | `getSmolkenNames()`          |
| [`Versilian`](#versilian)                   | VCSL multi-instrument (partial support)   | `getVersilianInstruments()`  |
| [`Soundfont2`](#soundfont2)                 | Reads .sf2 files directly                 | —                            |

Each names helper returns strings to pass as the factory's `instrument` option. `getVersilianInstruments` is async (the catalog is fetched once and cached).

To build your own instrument, see [Defining your own instrument](#defining-your-own-instrument).

## Using an instrument

The shared API below applies to every instrument. Instrument-specific options live in the [Instrument reference](#instrument-reference).

### Create and load

Every smplr instrument is a factory function: call it with an `AudioContext` and an options object to get back an instance.

```js
import { SplendidGrandPiano, Soundfont } from "smplr";

const context = new AudioContext();
const piano = SplendidGrandPiano(context, { decayTime: 0.5 });
const marimba = Soundfont(context, { instrument: "marimba" });
```

#### Wait for audio loading

You can start playing notes as soon as one sample is loaded. To wait for all of them, await either:

- `piano.ready` — resolves to `void` (preferred for new code).
- `piano.load` — resolves to the instrument itself, so you can create and await in one line:

```js
const piano = await SplendidGrandPiano(context).load;
```

> Upgrading from older versions? See [MIGRATE.md](./MIGRATE.md).

#### Load progress

Track how many samples have loaded via the `onLoadProgress` option or the `loadProgress` getter:

```js
const piano = SplendidGrandPiano(context, {
  onLoadProgress: ({ loaded, total }) => {
    console.log(`${loaded} / ${total} samples loaded`);
  },
});

// Or poll at any time:
console.log(piano.loadProgress); // { loaded: 12, total: 48 }
```

`total` is known before loading starts, so you can display a determinate progress bar.

### Shared configuration options

All instruments share some configuration options, passed as the second argument to the factory. Every field is optional:

- `volume`: a number from 0 to 127 representing the instrument's global volume. 100 by default.
- `velocity`: default note velocity (0–127) when not specified per note. 100 by default.
- `pan`: stereo pan, -1 (full left) to +1 (full right). 0 by default.
- `destination`: the `AudioNode` the instrument writes to. `AudioContext.destination` by default.
- `volumeToGain`: a function to map MIDI volume to a linear gain. Uses the MIDI standard curve by default.
- `storage`: a [storage backend](#caching-samples) used to fetch sample buffers. `HttpStorage` by default.
- `loader`: a shared `SampleLoader` instance. Pass the same loader to multiple instruments to cache buffers across them (see [Buffer reuse](#buffer-reuse)).
- `scheduler`: a shared `Scheduler` instance. Construct your own to tune scheduling — for example, `Scheduler(context, { lookaheadMs: 100, intervalMs: 25 })` — or omit to get a per-instrument default.
- `onLoadProgress`: a function called after each sample buffer is decoded. Receives `{ loaded, total }` where `total` is the full count known before loading starts.
- `onStart`: called when a note is dispatched to the audio engine. Receives the started note. See ⚠️ note under [Events](#events) on timing precision.
- `onEnded`: called when each voice's audio node ends. Receives the started note.

### Play notes

#### Start and stop notes

The `start` function accepts these options:

```js
piano.start({ note: "C4", velocity: 80, time: 5, duration: 1 });
```

`velocity` (0–127) represents how hard the key is pressed: louder at higher values, and on some instruments it also changes timbre.

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

Or stop the specified one. The argument is a `stopId` — by default the same value you passed as `note`, but you can override it via `start({ note, stopId })`:

```js
piano.stop("C4"); // stop the note(s) started with `note: "C4"`
piano.stop(60); // stop the note(s) started with `note: 60`
```

#### Schedule notes

Schedule notes via the `time` and `duration` properties (both in seconds). `time` is measured against `audioContext.currentTime`.

This plays a C major arpeggio, one note per second:

```js
const now = context.currentTime;
["C4", "E4", "G4", "C5"].forEach((note, i) => {
  piano.start({ note, time: now + i, duration: 0.5 });
});
```

#### Looping

You can loop a note by using `loop`, `loopStart` and `loopEnd`:

```js
const context = new AudioContext();
const sampler = Sampler(context, {
  buffers: { duh: "https://example.com/duh-duh-ah.mp3" },
});
sampler.start({
  note: "duh",
  loop: true,
  loopStart: 1.0,
  loopEnd: 9.0,
});
```

If `loop` is true but `loopStart` or `loopEnd` are not specified, 0 and total duration will be used by default, respectively.

### Output

#### Volume

Instrument `output` attribute represents the main output of the instrument. The `output.volume` getter/setter accepts a number where 0 means no volume, and 127 is max volume without amplification:

```js
piano.output.volume = 80;
piano.output.volume; // => 80
```

⚠️ `volume` is global to the instrument, but `velocity` is specific for each note.

#### Pan, detune, and reverse

Every instrument accepts a `pan` option at construction (`-1` = full left, `+1` = full right):

```js
const drums = DrumMachine(context, { instrument: "TR-808", pan: -0.5 });
```

Two universal setters mutate the playback defaults in place. They apply to notes scheduled **after** the call; in-flight notes are unaffected.

```js
sampler.setDetune(100); // semitone up (100 cents) for all future notes
sampler.setReverse(true); // play samples reversed for all future notes
sampler.setReverse(false); // back to forward playback
```

#### MIDI CC

Set and read MIDI Control Change values on the instrument:

```js
piano.setCC(64, 127); // sustain pedal on
piano.getCC(64); // => 127
piano.setCC(64, 0); // sustain pedal off
```

Unset CCs default to `0` (matches MIDI's "undefined controller defaults to 0" convention).

### Effects

#### Reverb

A packaged version of the [DattorroReverbNode](https://github.com/khoin/DattorroReverbNode) algorithmic reverb is included.

Use `output.addEffect(name, effect, mix)` to connect an effect using a send bus:

```js
import { Reverb, SplendidGrandPiano } from "smplr";
const reverb = Reverb(context);
const piano = SplendidGrandPiano(context, { volume });
piano.output.addEffect("reverb", reverb, 0.2);
```

To change the mix level, use `output.setEffectMix(name, mix)`:

```js
piano.output.setEffectMix("reverb", 0.5);
```

### Events

Two events are available: `onStart` and `onEnded`. Both callbacks receive the started note as a parameter, and can be configured globally:

```js
const context = new AudioContext();
const piano = SplendidGrandPiano(context, {
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

⚠️ The invocation time of `onStart` is not exact: it fires slightly before the audio actually starts, by up to the scheduler's lookahead window (200ms by default; configurable via the `scheduler` option — see [Shared configuration options](#shared-configuration-options)).

### Dispose

When you're done with an instrument, call `dispose()` to stop all voices, tear down the audio graph, and stop the scheduler. The instance must not be used after this call.

```js
useEffect(() => {
  const piano = SplendidGrandPiano(context);
  return () => piano.dispose();
}, []);
```

### Caching samples

The default sample sets are hosted on GitHub Pages, which rate-limits requests per second. That can be a problem, especially in a development environment with hot reload (most React frameworks).

To cache samples in the browser, use a `CacheStorage` object:

```ts
import { SplendidGrandPiano, CacheStorage } from "smplr";

const context = new AudioContext();
const storage = CacheStorage();
// First time the instrument loads, will fetch the samples from http. Subsequent times from cache.
const piano = SplendidGrandPiano(context, { storage });
```

⚠️ `CacheStorage` is based on the [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache) and only works in secure environments that run over `https`. Check your framework's documentation for local-HTTPS setup — for example [next-dev-https](https://www.npmjs.com/package/next-dev-https) for Next.js or [vite-plugin-mkcert](https://github.com/liuweiGL/vite-plugin-mkcert) for Vite.

### Using with standardized-audio-context

This package should be compatible with [standardized-audio-context](https://github.com/chrisguttandin/standardized-audio-context):

```js
import { AudioContext } from "standardized-audio-context";

const context = new AudioContext();
const piano = SplendidGrandPiano(context);
```

However, if you are using Typescript, you might need to "force cast" the types:

```ts
import { Soundfont } from "smplr";
import { AudioContext as StandardizedAudioContext } from "standardized-audio-context";

const context = new StandardizedAudioContext() as unknown as AudioContext;
const marimba = Soundfont(context, { instrument: "marimba" });
```

If you use `Reverb` (or anything else that needs `AudioWorkletNode`), force the `standardized-audio-context` version:

```ts
import {
  AudioWorkletNode,
  IAudioContext,
  AudioContext as StandardizedAudioContext,
} from "standardized-audio-context";

window.AudioWorkletNode = AudioWorkletNode as any;
const context = new StandardizedAudioContext() as unknown as AudioContext;

// ... rest of the code
```

See [standardized-audio-context issue #897](https://github.com/chrisguttandin/standardized-audio-context/issues/897) for background on why the cast is required.

## Sequencer

`Sequencer` schedules notes from one or more tracks against any smplr instrument with sample-accurate timing.

```js
import { Sequencer, SplendidGrandPiano, DrumMachine } from "smplr";

const context = new AudioContext();
const piano = SplendidGrandPiano(context);
const drums = DrumMachine(context, { instrument: "TR-808" });

const seq = Sequencer(context, { bpm: 120, loop: true });

seq.addTrack(piano, [
  { note: "C4", at: "1:1", duration: "4n" },
  { note: "E4", at: "1:2", duration: "4n" },
  { note: "G4", at: "1:3", duration: "4n" },
  { note: "C5", at: "1:4", duration: "2n" },
]);

seq.addTrack(drums, [
  { note: "kick", at: "1:1" },
  { note: "snare", at: "1:2" },
  { note: "kick", at: "1:3" },
  { note: "snare", at: "1:4" },
]);

seq.loopEnd = "2:1"; // 1 bar
seq.start();
```

#### Time notation

Note positions and durations accept several formats:

| Format     | Meaning                        |
| ---------- | ------------------------------ |
| `"4n"`     | quarter note                   |
| `"8n"`     | eighth note                    |
| `"4n."`    | dotted quarter (1.5×)          |
| `"1m"`     | one measure                    |
| `"2:1"`    | bar 2, beat 1 (1-indexed)      |
| `"2:3:48"` | bar 2, beat 3, +48 ticks       |
| `96`       | raw ticks (number passthrough) |

#### Constructor options

```js
const seq = Sequencer(context, {
  bpm: 120, // default 120
  ppq: 480, // pulses per quarter note, default 480
  timeSignature: 4, // accepts `4` (→ 4/4) or `{ numerator, denominator }`
  loop: false, // default false
  loopStart: 0, // loop start position (ticks or string)
  loopEnd: "2:1", // loop end position; defaults to end of longest track
  lookaheadMs: 200, // scheduling lookahead, default 200
  intervalMs: 50, // flush interval, default 50
  humanize: { timingMs: 10, velocity: 8 }, // optional randomisation
  stepSize: "16n", // optional: emit "step" events at this interval
});
```

`timeSignature` accepts a plain number (interpreted as `{ numerator: n, denominator: 4 }`) or a full object such as `{ numerator: 7, denominator: 8 }` for 7/8 time. The `seq.timeSignature` getter always returns the `{ numerator, denominator }` form.

#### Tracks

```js
seq.addTrack(piano, notes); // append a track
seq.addTrack(drums, notes, { id: "drums", volume: 0.8 }); // with options
seq.removeTrack(piano); // remove by instrument reference
seq.clearTracks(); // remove every track
```

`addTrack`'s third argument accepts:

| Field      | Type                                       | Description                                                          |
| ---------- | ------------------------------------------ | -------------------------------------------------------------------- |
| `id`       | `string`                                   | Stable id for `setTrackVolume` / `muteTrack` / `soloTrack`.          |
| `humanize` | `{ timingMs?: number; velocity?: number }` | Per-track humanize. Overrides the sequencer-level setting when set.  |
| `volume`   | `number`                                   | Multiplicative velocity scalar (default 1). `0.5` halves velocities. |
| `muted`    | `boolean`                                  | When true, this track does not dispatch notes.                       |
| `solo`     | `boolean`                                  | When true, only soloed tracks play.                                  |

After `setPatterns` is called (see [Pattern chain](#pattern-chain-song-mode)), `addTrack` / `removeTrack` / `clearTracks` throw — the chain is owned by the patterns array.

#### Track mixer

```js
seq.setTrackVolume("drums", 0.6);
seq.muteTrack("drums");
seq.unmuteTrack("drums");
seq.soloTrack("lead");
seq.unsoloTrack("lead");
```

Mixer methods operate on the **currently-playing pattern** (so per-pattern mute/solo state is automatic when using a pattern chain). Calls with an unknown id are no-ops.

#### Playback

```js
seq.start(); // start from beginning (or resume from pause if no offset given)
seq.pause(); // freeze position
seq.stop(); // stop and reset to 0
seq.togglePlayPause(); // pause if playing, start/resume otherwise

seq.state; // "stopped" | "playing" | "paused"
```

Individual sequenced notes can be stopped by their id:

```js
seq.stopNote("intro-c"); // stop immediately
seq.stopNote("intro-c", time); // stop at a scheduled time
```

#### Tempo and position

```js
seq.bpm = 140; // change BPM live, no glitch
seq.timeSignature = 3; // 3/4 (number → { numerator: 3, denominator: 4 })
seq.timeSignature = { numerator: 7, denominator: 8 }; // 7/8

seq.timeSignature; // → { numerator: 7, denominator: 8 }

seq.position; // current position as "bar:beat:tick" string
seq.position = "3:1"; // seek while playing or stopped
```

The `"beat"` event fires once per denominator-defined note: 4/4 → 4 beats per bar, 6/8 → 6 beats per bar, etc.

#### Loop

```js
seq.loop = true;
seq.loopStart = "1:1"; // ticks or string notation
seq.loopEnd = "3:1"; // ticks or string notation

seq.progress; // 0..1 within the loop range
```

#### Pattern API

`scheduleRepeat` fires a callback at a regular musical interval, passing the exact AudioContext time:

```js
const cancel = seq.scheduleRepeat((time) => {
  piano.start({ note: "C4", time, duration: 0.1 });
}, "8n"); // every eighth note

cancel(); // stop repeating
```

An optional third argument sets the start position:

```js
seq.scheduleRepeat(callback, "4n", "2:1"); // start at bar 2
```

#### Events

```js
seq.on("statechange", (state) => {
  // state: "playing" | "paused" | "stopped"
  setSeqState(state);
});

seq.on("beat", (beat, time) => {
  const delay = (time - context.currentTime) * 1000;
  setTimeout(() => metronome.flash(), delay);
});

seq.on("bar", (bar, time) => {
  ui.updateBar(bar);
});
seq.on("step", (stepIndex, time) => {
  ui.flashStep(stepIndex); // only fires when `stepSize` is set in options
});
seq.on("loop", () => {
  console.log("looped");
});
seq.on("end", () => {
  console.log("done");
});
seq.on("patternChange", (patternIndex, time) => {
  ui.highlightPattern(patternIndex); // fires when the chain advances
});
seq.on("start", () => {});
seq.on("stop", () => {});
seq.on("pause", () => {});

seq.off("beat", handler); // remove a listener
```

The `"step"` event only fires when the sequencer was constructed with `stepSize` (e.g. `"16n"`).
The `"patternChange"` event only fires when more than one pattern is in the chain.

#### Note events

`noteOn` and `noteOff` events fire when the instrument's `onStart` / `onEnded` callbacks are called, so they are driven by the actual audio playback — not by the scheduling lookahead.

```js
seq.on("noteOn", (event) => {
  console.log(event.noteId, event.trackIndex, event.noteIndex);
  highlight(event.noteId);
});
seq.on("noteOff", (event) => {
  unhighlight(event.noteId);
});
```

The `event` object (`NoteEvent`) contains:

| Field        | Type               | Description                                            |
| ------------ | ------------------ | ------------------------------------------------------ |
| `noteId`     | `string \| number` | The note's `id` if provided, otherwise its array index |
| `trackIndex` | `number`           | Index of the track in the order it was added           |
| `noteIndex`  | `number`           | Index of the note within its track's notes array       |
| `note`       | `SequencerNote`    | The original note object                               |

You can set a custom `id` on any `SequencerNote` to use as `noteId`:

```js
seq.addTrack(piano, [
  { id: "intro-c", note: "C4", at: "1:1", duration: "4n" },
  { id: "intro-e", note: "E4", at: "1:2", duration: "4n" },
]);
```

#### Humanize

Add subtle randomisation to timing and velocity for a more natural feel:

```js
const seq = Sequencer(context, {
  bpm: 90,
  humanize: { timingMs: 12, velocity: 8 },
});
```

- `timingMs`: maximum random offset in milliseconds (±). Default 0.
- `velocity`: maximum random offset in MIDI velocity units (±). Default 0.

Per-track humanize (passed to `addTrack`) overrides the global setting:

```js
seq.addTrack(piano, notes, { humanize: { timingMs: 0, velocity: 0 } });
```

#### SequencerNote fields

| Field                  | Type                | Description                                                                   |
| ---------------------- | ------------------- | ----------------------------------------------------------------------------- |
| `note`                 | `string \| number`  | Note name or MIDI number.                                                     |
| `at`                   | `string \| number`  | Musical position (ticks or `"bar:beat[.frac][:ticks]"` / `"4n"` / `"1m"`).    |
| `duration`             | `string \| number?` | Duration; omit for a one-shot trigger.                                        |
| `velocity`             | `number?`           | Velocity 0–127. Default 100.                                                  |
| `id`                   | `string \| number?` | Used as `noteId` in `noteOn` / `noteOff` events. Default: array index.        |
| `chance`               | `number?`           | Probability 0–100 that this note fires on each pass. Re-rolled on every loop. |
| `ratchet`              | `number?`           | Expand into N sub-notes over `duration` (requires `duration`).                |
| `ratchetVelocityDecay` | `number?`           | Per-step velocity decay; each sub-note scaled by `(1 - decay)^i`.             |

Example:

```js
seq.addTrack(drums, [
  {
    note: "hat",
    at: "1:4",
    duration: "8n",
    ratchet: 4,
    ratchetVelocityDecay: 0.2,
  },
  { note: "snare", at: "1:2", chance: 50 }, // fires 50% of the time
]);
```

When `ratchet > 1`, each sub-note's `noteId` is suffixed with `#0`, `#1`, etc., so you can stop an individual sub-voice via `seq.stopNote("id#0")`.

#### Pattern chain (song mode)

For multi-pattern arrangements (intro → verse → chorus), use `setPatterns`:

```js
seq.setPatterns([
  { tracks: [{ instrument: drums, notes: introNotes }], loopEnd: "1m" },
  { tracks: [{ instrument: drums, notes: verseNotes }], loopEnd: "2m" },
  { tracks: [{ instrument: drums, notes: chorusNotes }], loopEnd: "2m" },
]);

seq.chainOrder = [0, 1, 2, 1, 2]; // intro, verse, chorus, verse, chorus
seq.loop = true; // loop the whole chain
seq.start();

seq.on("patternChange", (idx) => ui.highlightPattern(idx));
```

- Each pattern's `tracks` entries accept the same `AddTrackOptions` (`id`, `humanize`, `volume`, `muted`, `solo`) as `addTrack`.
- `loopEnd` is per-pattern and defaults to the longest track in that pattern.
- `chainOrder` defaults to `[0, 1, …, n-1]`. Setting it lets you repeat or reorder patterns without duplicating data.
- With `loop: false` the chain plays once and emits `"end"`; with `loop: true` it cycles indefinitely and emits `"loop"` each time it wraps.
- Track mixer methods (`muteTrack`, `setTrackVolume`, etc.) operate on the currently-playing pattern — `muteTrack("lead")` only affects the pattern that owns the `"lead"` track.

---

## Offline rendering

Render audio offline (faster than real-time) and export it as a WAV file. Uses `OfflineAudioContext` under the hood.

```js
import { renderOffline } from "smplr";

const result = await renderOffline(async (context) => {
  const piano = await SplendidGrandPiano(context).load;
  piano.start({ note: "C4", time: 0, duration: 1 });
  piano.start({ note: "E4", time: 0.5, duration: 1 });
});

result.downloadWav("export.wav");
```

#### Options

```js
const result = await renderOffline(callback, {
  duration: 10, // Total duration in seconds (auto-detected if omitted)
  sampleRate: 48000, // Sample rate (default: 48000)
  channels: 2, // Number of channels (default: 2)
});
```

When `duration` is omitted, a 60-second buffer is used and trailing silence is automatically trimmed. Pass an explicit `duration` for longer renders or to preserve trailing silence.

#### RenderResult

`renderOffline` returns a `RenderResult` object:

- `result.audioBuffer` — the raw `AudioBuffer`
- `result.toWav()` — encode as 32-bit float WAV `Blob` (lossless)
- `result.toWav16()` — encode as 16-bit integer WAV `Blob` (smaller file)
- `result.downloadWav(filename?)` — download as 32-bit WAV
- `result.downloadWav16(filename?)` — download as 16-bit WAV
- `result.duration` — actual duration in seconds
- `result.sampleRate` — sample rate used

WAV encoding is lazy — it only happens when you call `toWav()` or `toWav16()`.

#### Buffer reuse

If you already have an instrument loaded, pass the same `SampleLoader` to avoid re-fetching samples:

```js
import { SplendidGrandPiano, SampleLoader, renderOffline } from "smplr";

const loader = SampleLoader(audioContext);
const piano = SplendidGrandPiano(audioContext, { loader });
await piano.load;

// Offline render reuses cached buffers — no re-fetch
const result = await renderOffline(async (context) => {
  const offlinePiano = await SplendidGrandPiano(context, { loader }).load;
  offlinePiano.start({ note: "C4", time: 0, duration: 1 });
});
```

#### Bug reports

Use offline rendering to generate reproducible audio files for issue reports. No install needed — just open your browser's DevTools console on any page and paste:

```js
const { renderOffline, SplendidGrandPiano } =
  await import("https://esm.sh/smplr");

const result = await renderOffline(async (context) => {
  const piano = await SplendidGrandPiano(context).load;
  piano.start({ note: "C4", time: 0, duration: 2 });
});
result.downloadWav16("bug-report.wav");
```

This will download a WAV file you can attach to your issue or pull request.

---

## Instrument reference

Detailed configuration for each bundled instrument. For the shared API (load, play, output, effects, events), see [Using an instrument](#using-an-instrument).

### Sampler

An audio buffer sampler. Pass a `buffers` map of name → URL:

#### Buffers mode

```js
import { Sampler } from "smplr";

const buffers = {
  kick: "https://smpldsnds.github.io/drum-machines/808-mini/kick.m4a",
  snare: "https://smpldsnds.github.io/drum-machines/808-mini/snare-1.m4a",
};
const sampler = Sampler(new AudioContext(), { buffers });
```

And then use the name of the buffer as note name:

```js
sampler.start({ note: "kick" });
```

#### Preset mode

For advanced use cases (per-region pitch/velocity/round-robin, SFZ-like multi-sample instruments, runtime swaps), pass a `SmplrPreset` directly:

```ts
import { Sampler, type SmplrPreset } from "smplr";

const kitA: SmplrPreset = {
  samples: { baseUrl: "https://cdn.example.com/", formats: ["ogg"] },
  groups: [
    {
      regions: [
        { sample: "kick", keyRange: [60, 60], pitch: 60 },
        { sample: "snare", keyRange: [62, 62], pitch: 62 },
      ],
    },
  ],
};

const sampler = Sampler(new AudioContext(), { preset: kitA });
await sampler.ready;
sampler.start({ note: 60 });

// Swap content at runtime
await sampler.reload(kitB);
```

The full `SmplrPreset` schema is documented in [SMPLR_PRESET.md](./SMPLR_PRESET.md). Note: `buffers` and `preset` are mutually exclusive on construction — pass exactly one.

`sampler.reload(input)` accepts either shape (flat buffers record or full `SmplrPreset`), regardless of which mode was used at construction.

### Soundfont

A Soundfont player. By default it loads audio from Benjamin Gleitzman's package of
[pre-rendered sound fonts](https://github.com/gleitz/midi-js-soundfonts).

```js
import { Soundfont, getSoundfontNames, getSoundfontKits } from "smplr";

const marimba = Soundfont(new AudioContext(), { instrument: "marimba" });
marimba.start({ note: "C4" });
```

It's intended to be a modern replacement of [soundfont-player](https://github.com/danigb/soundfont-player)

#### Soundfont instruments and kits

Use `getSoundfontNames` to get all available instrument names and `getSoundfontKits` to get kit names.

There are two kits available: `MusyngKite` or `FluidR3_GM`. The first one is used by default: it sounds better but the samples are heavier.

```js
const marimba = Soundfont(context, {
  instrument: "clavinet",
  kit: "FluidR3_GM", // "MusyngKite" is used by default if not specified
});
```

Alternatively, you can pass your custom url as the instrument. In that case, the `kit` is ignored:

```js
const marimba = Soundfont(context, {
  instrumentUrl:
    "https://gleitz.github.io/midi-js-soundfonts/MusyngKite/marimba-mp3.js",
});
```

#### Soundfont sustained notes

You can enable note looping to make note names indefinitely long by loading loop data:

```js
const marimba = Soundfont(context, {
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

const piano = SplendidGrandPiano(new AudioContext());

piano.start({ note: "C4" });
```

#### SplendidGrandPiano constructor

The second argument of the constructor accepts the following options:

- `baseUrl`: where the piano samples are fetched from. Defaults to the public hosted set on `smpldsnds.github.io`; override only if you mirror the samples yourself.
- `detune`: global detune in cents (0 if not specified)
- `velocity`: default velocity (100 if not specified)
- `volume`: default volume (100 if not specified)
- `decayTime`: default decay time (0.5 seconds)
- `notesToLoad`: an object with the following shape: `{ notes: number[], velocityRange: [number, number]}` to specify a subset of notes to load

Example:

```ts
const piano = SplendidGrandPiano(context, {
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

const instruments = getElectricPianoNames(); // => ["CP80", "PianetT", "WurlitzerEP200", "TX81Z"]

const epiano = ElectricPiano(new AudioContext(), {
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
- `TX81Z`: Yamaha TX81Z "FM Piano" patch (from the VCSL Electrophones set)

### Mallets

Samples from [The Versilian Community Sample Library](https://github.com/sgossner/VCSL)

```js
import { Mallet, getMalletNames } from "smplr";

const instruments = getMalletNames();

const mallet = Mallet(new AudioContext(), {
  instrument: instruments[0],
});
```

### Mellotron

Samples from [archive.org](https://archive.org/details/mellotron-archive-cd-rom-nki-wav.-7z)

```js
import { Mellotron, getMellotronNames } from "smplr";

const instruments = getMellotronNames();

const mellotron = Mellotron(new AudioContext(), {
  instrument: instruments[0],
});
```

### Drum Machines

Sampled drum machines. Samples from different sources:

```js
import { DrumMachine, getDrumMachineNames } from "smplr";

const instruments = getDrumMachineNames();

const context = new AudioContext();
const drums = DrumMachine(context, { instrument: "TR-808" });
drums.start({ note: "kick" });

// Drum samples are grouped and can have sample variations:
drums.getSampleNames(); // => ['kick-1', 'kick-2', 'snare-1', 'snare-2', ...]
drums.getGroupNames(); // => ['kick', 'snare']
drums.getSampleNamesForGroup("kick"); // => ['kick-1', 'kick-2']

// You can trigger samples by group name or specific sample
drums.start("kick"); // Play the first sample of the group
drums.start("kick-1"); // Play this specific sample
```

### DrumAbuse

Sampled instrument for the [Synthabuse](https://www.youtube.com/watch?v=Ay-U9eYKmGA) drum-machine collection — 5 packs covering ~210 classic drum machines and synths. Samples hosted at `smpldsnds.github.io/drum-abuse-{pack}/`.

Two source modes: load a single machine's full kit, or load a cross-machine instrument list from a pack.

#### Machine mode

```js
import { DrumAbuse, getDrumAbuseMachineNames } from "smplr";

const machines = getDrumAbuseMachineNames(); // ~210 machine ids

const context = new AudioContext();
const drums = DrumAbuse(context, {
  source: { kind: "machine", machine: "roland-tr-808" },
});
await drums.load;

drums.start({ note: "kick" });

// Samples are grouped by instrument name, like DrumMachine:
drums.getGroupNames(); // => ["kick", "snare", "hi-hat", ...]
drums.getSampleNamesForGroup("kick"); // => ["kick/1", "kick/2", ...]
drums.start({ note: "kick" }); // first sample in the group
drums.start({ note: "kick/1" }); // a specific sample
```

If a machine has more than one sample set, pass `set` to pick a specific one. Omit to load the first set.

```js
const drums = DrumAbuse(context, {
  source: { kind: "machine", machine: "roland-tr-808", set: "kit-a" },
});
```

#### Pack mode

A pack is a cross-machine catalog of named instruments (e.g. all the kicks across `vol1`). Pass `source: { kind: "pack", pack, instrument }`:

```js
import {
  DrumAbuse,
  getDrumAbusePackNames,
  getDrumAbuseMachinesForPack,
} from "smplr";

getDrumAbusePackNames(); // => ["vol1", "vol2", "vol3", "vol4", "vol5"]
getDrumAbuseMachinesForPack("vol1"); // => machine ids in vol1

const drums = DrumAbuse(new AudioContext(), {
  source: { kind: "pack", pack: "vol1", instrument: "bass-drum" },
});
```

### Smolken double bass

```js
import { Smolken, getSmolkenNames } from "smplr";

const instruments = getSmolkenNames(); // => Arco, Pizzicato & Switched

// Create an instrument
const context = new AudioContext();
const doubleBass = await Smolken(context, { instrument: "Arco" }).load;
```

### Versilian

Plays instruments from the [Versilian Community Sample Library](https://github.com/sgossner/VCSL).

⚠️ Not all features are implemented. Some instruments may sound incorrect ⚠️

```js
import { Versilian, getVersilianInstruments } from "smplr";

// getVersilianInstruments returns a Promise
const instrumentNames = await getVersilianInstruments();

const context = new AudioContext();
const versilian = Versilian(context, { instrument: instrumentNames[0] });
```

### Soundfont2

Sampler capable of reading .sf2 files directly.

```ts
import { Soundfont2 } from "smplr";
import { SoundFont2 } from "soundfont2";

const context = new AudioContext();
const sampler = Soundfont2(context, {
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

## Defining your own instrument

If none of the bundled instruments fits your use case, you can author your own with the `Instrument` builder and the `Smplr` interface.

See **[Defining an instrument](./AUTHORING.md)** for the full authoring guide — sync and async examples, third-party package layout, and how to use `Smplr` as a TypeScript type for generic helpers.

## Upgrading

`smplr` is approaching 1.0; pre-1.0 APIs keep working as deprecated aliases. See [MIGRATE.md](./MIGRATE.md) for the full compatibility table and [CHANGELOG](https://github.com/danigb/smplr/blob/main/CHANGELOG.md) for per-release detail.

## License

MIT License
