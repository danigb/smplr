# [smplr](https://github.com/danigb/smplr)

[![npm version](https://img.shields.io/npm/v/smplr)](https://www.npmjs.com/package/smplr)

> `smplr` is a collection of sampled instruments for Web Audio API ready to be used with no setup required.

Examples:

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

const seq = new Sequencer(context, { bpm: 110, loop: true });
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
  piano.output.addEffect("reverb", new Reverb(context), 0.3);
  ["C4", "E4", "G4", "C5"].forEach((note, i) => {
    piano.start({ note, time: i * 0.4, duration: 0.4 });
  });
});
wav.downloadWav("arpeggio.wav");
```

See demo: https://danigb.github.io/smplr/

`smplr` is approaching 1.0. The 0.22.0 release lands the final batch of pre-1.0 API work — every documented `new X(ctx, opts)` keeps working, and the documented surface is intended to ship unchanged into 1.0. The formal stability commitment lands once the narrow `loader`/`scheduler` public interfaces sibling ticket is in (see [CHANGELOG](https://github.com/danigb/smplr/blob/main/CHANGELOG.md)).

> **Upgrading from an earlier 0.x?** No code changes are required — every documented `new X(ctx, opts)` keeps working. New code should drop the `new` (`X(ctx, opts)`) and prefer `await x.ready` over `await x.load`.

#### Library goals

- No setup: specifically, all samples are online, so no need for a server.
- Easy to use: everything should be intuitive for non-experienced developers
- Decent sounding: uses high quality open source samples. For better or worse, it is sample based 🤷

## Setup

You can install the library with a package manager or use it directly by importing from the browser.

Samples are stored at https://github.com/smpldsnds and there is no need to download them. Kudos to all _samplerist_ 🙌

#### Using a package manager

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
    const piano = SplendidGrandPiano(context); // create and load the instrument

    document.getElementById("btn").onclick = () => {
      context.resume(); // enable audio context after a user interaction
      piano.start({ note: 60, velocity: 80 }); // play the note
    };
  </script>
</html>
```

The package needs to be served as a URL from a service like [unpkg](https://unpkg.com) or similar.

> To author your own instrument or publish a third-party package, see the [Defining an instrument](./AUTHORING.md) guide.

## Documentation

### Defining an instrument

`smplr` ships ten instruments out of the box — `SplendidGrandPiano`, `Soundfont`, `DrumMachine`, `ElectricPiano`, `Mallet`, `Mellotron`, `Smolken`, `Versilian`, `Sampler`, `Soundfont2Sampler`. If none of them fit your use case, you can author your own with the `Instrument` builder and the `Smplr` interface.

See **[Defining an instrument](./AUTHORING.md)** for the full authoring guide — sync and async examples, third-party package layout, and how to use `Smplr` as a TypeScript type for generic helpers.

### Create and load an instrument

Every smplr instrument is a factory function: call it with an `AudioContext` and an options object to get back an instance.

```js
import { SplendidGrandPiano, Soundfont } from "smplr";

const context = new AudioContext();
const piano = SplendidGrandPiano(context, { decayTime: 0.5 });
const marimba = Soundfont(context, { instrument: "marimba" });
```

> **Compatibility note:** All factories also support the `new` keyword — `new SplendidGrandPiano(context)` produces the same instance as `SplendidGrandPiano(context)`. Code from earlier `smplr` versions keeps working unchanged. Editors will mark the `new` form as `@deprecated` to nudge new code toward the call form; both remain supported throughout the 1.x line.

#### Wait for audio loading

You can start playing notes as soon as one audio is loaded. But if you want to wait for all of them, you can use the `load` property that returns a promise:

```js
piano.load.then(() => {
  // now the piano is fully loaded
});
```

Since the promise returns the instrument instance, you can create and wait in a single line:

```js
const piano = await SplendidGrandPiano(context).load;
```

The pre-1.0 `new`-prefixed form continues to work — `const piano = await new SplendidGrandPiano(context).load` resolves to the same instrument. This is the documented backward-compat path for code from earlier `smplr` versions.

> **New in 1.0:** prefer `await piano.ready` for new code. It resolves to `void` (not the instrument) and won't be removed — `.load` is kept as a deprecated alias for compatibility.

⚠️ In versions lower than 0.8.0 a `loaded()` function was exposed instead.

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

#### Shared configuration options

All instruments share some configuration options, passed as the second argument to the factory. Every field is optional:

- `volume`: a number from 0 to 127 representing the instrument's global volume. 100 by default.
- `velocity`: default note velocity (0–127) when not specified per note. 100 by default.
- `pan`: stereo pan, -1 (full left) to +1 (full right). 0 by default.
- `destination`: the `AudioNode` the instrument writes to. `AudioContext.destination` by default.
- `volumeToGain`: a function to map MIDI volume to a linear gain. Uses the MIDI standard curve by default.
- `storage`: a [storage backend](#cache-requests) used to fetch sample buffers. `HttpStorage` by default.
- `loader`: a shared `SampleLoader` instance. Pass the same loader to multiple instruments to cache buffers across them (see [Buffer reuse](#buffer-reuse)).
- `scheduler`: a shared `Scheduler` instance. Construct your own to tune scheduling — for example, `new Scheduler(context, { lookaheadMs: 100, intervalMs: 25 })` — or omit to get a per-instrument default.
- `onLoadProgress`: a function called after each sample buffer is decoded. Receives `{ loaded, total }` where `total` is the full count known before loading starts.
- `onStart`: called when a note is dispatched to the audio engine. Receives the started note. See ⚠️ note under [Events](#events) on timing precision.
- `onEnded`: called when each voice's audio node ends. Receives the started note.

#### Usage with standardized-audio-context

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

In case you need to use the `Reverb` module (or any other module that needs `AudioWorkletNode`) you need to enforce to use the one from `standardized-audio-context` package. Here is how:

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

Or stop the specified one. The argument is a `stopId` — by default the same value you passed as `note`, but you can override it via `start({ note, stopId })`:

```js
piano.stop("C4"); // stop the note(s) started with `note: "C4"`
piano.stop(60); // stop the note(s) started with `note: 60`
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

#### Change volume

Instrument `output` attribute represents the main output of the instrument. The `output.volume` getter/setter accepts a number where 0 means no volume, and 127 is max volume without amplification:

```js
piano.output.volume = 80;
piano.output.volume; // => 80
```

`output.setVolume(n)` is kept as a deprecated alias and continues to work.

⚠️ `volume` is global to the instrument, but `velocity` is specific for each note.

#### MIDI CC

Set and read MIDI Control Change values on the instrument:

```js
piano.setCC(64, 127); // sustain pedal on
piano.getCC(64); // => 127
piano.setCC(64, 0); // sustain pedal off
```

Unset CCs default to `0` (matches MIDI's "undefined controller defaults to 0" convention).

#### Disposing

When you're done with an instrument, call `dispose()` to stop all voices, tear down the audio graph, and stop the scheduler. The instance must not be used after this call.

```js
useEffect(() => {
  const piano = SplendidGrandPiano(context);
  return () => piano.dispose();
}, []);
```

`disconnect()` is kept as a deprecated alias and continues to work.

#### Events

Two events are supported `onStart` and `onEnded`. Both callbacks will receive as parameter started note.

Events can be configured globally:

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

### Effects

#### Reverb

A packaged version of the [DattorroReverbNode](https://github.com/khoin/DattorroReverbNode) algorithmic reverb is included.

Use `output.addEffect(name, effect, mix)` to connect an effect using a send bus:

```js
import { Reverb, SplendidGrandPiano } from "smplr";
const reverb = new Reverb(context);
const piano = SplendidGrandPiano(context, { volume });
piano.output.addEffect("reverb", reverb, 0.2);
```

To change the mix level, use `output.setEffectMix(name, mix)`:

```js
piano.output.setEffectMix("reverb", 0.5);
```

`output.sendEffect(name, mix)` is kept as a deprecated alias and continues to work.

### Cache requests

The default sample sets are hosted on GitHub Pages, which rate-limits requests per second. That can be a problem, especially in a development environment with hot reload (most React frameworks).

To cache samples in the browser, use a `CacheStorage` object:

```ts
import { SplendidGrandPiano, CacheStorage } from "smplr";

const context = new AudioContext();
const storage = new CacheStorage();
// First time the instrument loads, will fetch the samples from http. Subsequent times from cache.
const piano = SplendidGrandPiano(context, { storage });
```

⚠️ `CacheStorage` is based on the [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache) and only works in secure environments that run over `https`. Check your framework's documentation for local-HTTPS setup — for example [next-dev-https](https://www.npmjs.com/package/next-dev-https) for Next.js or [vite-plugin-mkcert](https://github.com/liuweiGL/vite-plugin-mkcert) for Vite.

## Sequencer

`Sequencer` schedules notes from one or more tracks against any smplr instrument with sample-accurate timing. Unlike instruments, it's a regular class — always constructed with `new Sequencer(context, opts)`.

```js
import { Sequencer, SplendidGrandPiano, DrumMachine } from "smplr";

const context = new AudioContext();
const piano = SplendidGrandPiano(context);
const drums = DrumMachine(context, { instrument: "TR-808" });

const seq = new Sequencer(context, { bpm: 120, loop: true });

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
const seq = new Sequencer(context, {
  bpm: 120, // default 120
  ppq: 480, // pulses per quarter note, default 480
  timeSignature: 4, // beats per bar, default 4
  loop: false, // default false
  loopStart: 0, // loop start position (ticks or string)
  loopEnd: "2:1", // loop end position; defaults to end of longest track
  lookaheadMs: 200, // scheduling lookahead, default 200
  intervalMs: 50, // flush interval, default 50
  humanize: { timingMs: 10, velocity: 8 }, // optional randomisation
});
```

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
seq.timeSignature = 3; // change time signature

seq.position; // current position as "bar:beat:tick" string
seq.position = "3:1"; // seek while playing or stopped
```

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
seq.on("loop", () => {
  console.log("looped");
});
seq.on("end", () => {
  console.log("done");
});
seq.on("start", () => {});
seq.on("stop", () => {});
seq.on("pause", () => {});

seq.off("beat", handler); // remove a listener
```

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
const seq = new Sequencer(context, {
  bpm: 90,
  humanize: { timingMs: 12, velocity: 8 },
});
```

- `timingMs`: maximum random offset in milliseconds (±). Default 0.
- `velocity`: maximum random offset in MIDI velocity units (±). Default 0.

---

## Export Audio

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

const loader = new SampleLoader(audioContext);
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

## Instruments

### Available instruments

Each instrument family exposes a synchronous helper that returns the names you can pass to its factory:

| Factory         | Names helper                                   |
| --------------- | ---------------------------------------------- |
| `Soundfont`     | `getSoundfontNames(): string[]`                |
| `ElectricPiano` | `getElectricPianoNames(): string[]`            |
| `Mallet`        | `getMalletNames(): string[]`                   |
| `Mellotron`     | `getMellotronNames(): string[]`                |
| `DrumMachine`   | `getDrumMachineNames(): string[]`              |
| `Smolken`       | `getSmolkenNames(): string[]`                  |
| `Versilian`     | `getVersilianInstruments(): Promise<string[]>` |

`getVersilianInstruments` is async because the catalog is fetched from the network on first call (cached thereafter).

### Sampler

An audio buffer sampler. Pass a `buffers` object with the files to be load:

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

#### Advanced mode

For advanced use cases (per-region pitch/velocity/round-robin, SFZ-like multi-sample instruments, runtime swaps), pass a `SmplrJson` schema directly:

```ts
import { Sampler, type SmplrJson } from "smplr";

const kitA: SmplrJson = {
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

const sampler = Sampler(new AudioContext(), { json: kitA });
await sampler.ready;
sampler.start({ note: 60 });

// Swap content at runtime
await sampler.reload(kitB);
```

The full `SmplrJson` schema is documented in [SMPLR_JSON.md](./SMPLR_JSON.md). Note: `buffers` and `json` are mutually exclusive on construction — pass exactly one.

`sampler.reload(input)` accepts either shape (flat buffers record or full `SmplrJson`), regardless of which mode was used at construction.

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

### Smolken double bass

```js
import { Smolken, getSmolkenNames } from "smplr";

const instruments = getSmolkenNames(); // => Arco, Pizzicato & Switched

// Create an instrument
const context = new AudioContext();
const doubleBass = await Smolken(context, { instrument: "Arco" }).load;
```

### Versilian

Versilian is a sample capable of using the [Versilian Community Sample Library](https://github.com/sgossner/VCSL).

⚠️ Not all features are implemented. Some instruments may sound incorrect ⚠️

```js
import { Versilian, getVersilianInstruments } from "smplr";

// getVersilianInstruments returns a Promise
const instrumentNames = await getVersilianInstruments();

const context = new AudioContext();
const versilian = Versilian(context, { instrument: instrumentNames[0] });
```

### Soundfont2Sampler

Sampler capable of reading .sf2 files directly:

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

Still limited support. API may vary.

## License

MIT License
