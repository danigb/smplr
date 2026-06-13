# smplr

## 1.0.0

First stable release.

### Changed (contract)

- **`offset` is now in seconds** (was sample frames), matching `loopStart` /
  `loopEnd`. Every playback time field now speaks one unit. No in-tree
  instrument set `offset`; external presets that did must divide their old
  frame value by the sample rate. See [MIGRATE.md](./MIGRATE.md).
- **`loopStart` / `loopEnd` documented as seconds.** No behavior change — the
  player and both Soundfont loaders already treated them as seconds; only the
  type comments and `PRESET_SCHEMA.md` (which wrongly said "sample frames / 0–1
  fraction") were corrected. For a fraction of the buffer, use `loopAuto`.
- **Send buses are documented as post-fader.** `output.addEffect(...)` taps the
  signal after `output.volume` and after inserts; lowering volume lowers the
  send. No behavior change — the routing is pinned by a new test.
- **`Soundfont2.loadInstrument(name)` throws on an unknown name** instead of
  silently returning `undefined`.

### Removed

- **`SmplrRegion.ampVelCurve`** — Removed from the public types and the SFZ
  converter. A proper multi-point velocity curve may return additively in a later 1.x.

### Fixed

- **Fetch errors are clear.** SFZ / metadata fetches in ElectricPiano,
  Mellotron, Smolken, Versilian, and the Soundfont loop-data path now reject
  with `smplr: failed to fetch <url> (<status>)` instead of feeding an HTML
  error body to a parser.
- **`drum-abuse` JSON cache no longer caches rejections** — a transient network
  failure can now retry instead of permanently re-rejecting.
- **Soundfont base64 decode is SSR-safe** — uses `atob` instead of
  `window.atob`, so it runs in Node / offline contexts.
- **Cache write failures warn once** instead of being silently swallowed.
- **Reverb `connect()` before the worklet is ready** now routes correctly
  (previously it could silently misroute). The worklet Blob URL is revoked
  after `addModule`, fixing a per-context leak.

## 0.26.0

Final pre-1.0 release. Lands the last gating item from the 1.0 stability
checklist (CHANGELOG §0.21 "Stability — 1.0 candidate") — narrow public
interfaces for `Scheduler` and `SampleLoader`. After this release the
documented surface is intended to ship unchanged into 1.0.

### Changed

- **`Scheduler` and `SampleLoader` are now narrowed interfaces, not impl
  classes.** The factory call signature is unchanged (`Scheduler(ctx, opts)` /
  `SampleLoader(ctx, opts)` — and `new` form continues to work as a
  `@deprecated` alias). The returned shape now exposes only the documented
  methods: `schedule` / `stop` on `Scheduler`, `load` on `SampleLoader`.
  Implementation classes (`SchedulerImpl`, `SampleLoaderImpl`) no longer
  appear in `dist/index.d.ts`. A new `__compat__/loader-scheduler-surface.test.ts`
  tripwire locks the surface against future drift.
- **New exported types**: `SchedulerOptions`, `SampleLoaderOptions`,
  `SampleLoaderLoadOptions` — make the documented factory option shapes
  typeable. `Scheduler(ctx, { lookaheadMs: 100, intervalMs: 25 })` now has
  IDE autocomplete on the options bag.

### Deprecated (still works)

- **`loader.load(json, (loaded, total) => void)`** — bare-callback form of
  the second argument is `@deprecated` in TSDoc. Pass an options object
  instead: `loader.load(json, { onProgress: (loaded, total) => …, buffers })`.
  Both forms continue to work in 1.x. See [MIGRATE.md](./MIGRATE.md).

### Fixed

- **`Reverb.getParam(name)`** now returns the requested AudioParam instead
  of always returning `preDelay`. Every reverb parameter except preDelay
  was previously unreadable/unwritable through the public API.
- **`Sequencer.stop()`** now calls the stop function on each active voice
  before clearing the map. Previously, notes already scheduled into the
  Web Audio graph within the `lookaheadMs` window kept playing after
  `stop()` returned.
- **`SmplrPreset.defaults.reverse`** (and group/region-level `reverse`)
  now propagate when no per-note override is set. Previously the
  preset-level value was silently dropped, leaving the offset mirror
  unapplied to reversed buffers.
- **Tremolo `disconnect()`** no longer throws `InvalidAccessError`: it now
  disconnects the actual graph edges (`lfo → lfoAmp → amp.gain`) rather
  than the non-existent `lfo → amp` edge. The intermediate amp gain nodes
  are also released for GC.
- **Mellotron / Soundfont loaders** no longer silently drop notes whose
  MIDI number is `0` (`C-1`). The `!midi` truthiness check has been
  replaced with `midi === undefined`.
- **`getVersilianInstruments()`** caches the in-flight promise instead of
  the resolved array, eliminating a race where two concurrent callers
  triggered two network fetches.

### Demo site

- **`PianoKeyboard`** highlights actually pressed keys — the `isPlaying`
  stub used to be hardcoded to `false`, so the `.--playing` CSS class
  never applied.
- **`ConnectMidi`** removes its WebMidi listeners on unmount, so
  navigating away no longer leaks MIDI handlers that still reference a
  disposed instrument.

### Docs

- **`SMPLR_PRESET.md` renamed to `PRESET_SCHEMA.md`.** The previous name
  duplicated the type name (`SmplrPreset`); the new name describes the
  file's role. README and AUTHORING.md cross-references updated.

## 0.25.0

### New

- **`DrumAbuse`** — sampled instrument for the
  [Synthabuse](https://www.youtube.com/watch?v=Ay-U9eYKmGA) drum-machine
  collection. 5 packs, ~210 vintage drum machines and synths. Two source
  modes: `source: { kind: "machine", machine }` loads one machine's full
  kit, `source: { kind: "pack", pack, instrument }` loads a cross-machine
  instrument list. Helpers: `getDrumAbuseMachineNames()`,
  `getDrumAbusePackNames()`, `getDrumAbuseMachinesForPack(pack)`,
  `getDrumAbuseMachinePack(id)`.

## 0.24.0

### New

- **`SequencerNote.ratchet` + `ratchetVelocityDecay`** — native sub-step
  expansion of a single note into N evenly-distributed sub-notes over the
  note's duration. Requires `duration`; silently ignored if omitted. Each
  sub-note's `noteId` is suffixed with `#0`, `#1`, … so individual ratchet
  voices can be stopped via `stopNote("id#0")`.
- **`Sequencer.addTrack(inst, notes, options?)`** — third options arg
  restored. `AddTrackOptions`: `id`, `humanize`, `volume`, `muted`, `solo`.
  Per-track `humanize` overrides the sequencer's global humanize.
- **Track mixer**: `setTrackVolume(id, v)`, `muteTrack(id)`,
  `unmuteTrack(id)`, `soloTrack(id)`, `unsoloTrack(id)` on `Sequencer`.
  Per-track mixer state is scoped to the pattern that owns the track.
- **`SequencerOptions.timeSignature` accepts `{ numerator, denominator }`**
  in addition to a plain `number` (treated as `{ numerator, denominator: 4 }`).
  The `timeSignature` getter always returns the object form.
- **`Smplr.setDetune(cents)` / `Smplr.setReverse(on)`** — universal live
  setters on every instrument. Mutate `SmplrPreset.defaults` in place; affect
  notes scheduled after the call. In-flight notes are unaffected.
- **`pan?: number` on every instrument's typed config** — was already
  accepted at construction; now discoverable in IDE autocomplete on
  `Sampler`, `SplendidGrandPiano`, `ElectricPiano`, `Mallet`, `Mellotron`,
  `Smolken`, `Versilian`, `Soundfont`, `Soundfont2Sampler`. (`DrumMachine`
  already had it.)
- **Pattern chain (song mode)**: `seq.setPatterns([...])` plus
  `seq.chainOrder = [...]`. Each pattern owns its own tracks and optional
  `loopEnd`. New `"patternChange"` event fires when the chain advances.
  `loop: true` loops the chain; `loop: false` plays the chain once and emits
  `"end"`. `addTrack` / `removeTrack` / `clearTracks` throw after
  `setPatterns` — use `setPatterns` to mutate the chain.
- **`PatternInput`, `TimeSignature`, `AddTrackOptions`** types exported from
  `smplr/sequencer`.

### New: factory-function consistency for auxiliary classes

- **`Sequencer`, `Reverb`, `CacheStorage`, `Scheduler`, `SampleLoader`** are
  now callable as factory functions in addition to the existing `new X(...)`
  form. `Sequencer(ctx, opts)` is the documented form going forward; the
  `new` form continues to work and is marked `@deprecated` on the type's
  construct overload. Matches the dual call/construct signature already
  shipped by every instrument factory.
- **`Soundfont2Sampler` renamed to `Soundfont2`** to match the naming
  pattern of every other instrument factory (`Sampler`, `Soundfont`,
  `DrumMachine`, …). The old `Soundfont2Sampler` name remains as a
  `@deprecated` alias — existing imports keep working without source
  changes; update at your leisure.

### Internal

- Internal default-construction sites for `Scheduler` and `SampleLoader`
  in `SmplrImpl` switched from `new X(...)` to bare-call form. No runtime
  behavior change; pure stylistic alignment with the documented public form.

### Changed (semi-breaking)

- **`"beat"` event** now fires once per `denominator`-defined note rather
  than per quarter note. For 4/4 the behaviour is identical (denominator 4 →
  quarter note); for 6/8 it changes from 4 beats per bar (wrong) to 6
  (correct). Any consumer relying on quarter-note beat semantics in non-4/4
  time must adapt. Migration: divide your beat count by `4 / denominator`
  to recover the old number.
- **`Sequencer.timeSignature` getter** now returns `TimeSignature`
  (`{ numerator, denominator }`) instead of `number`. Callers reading the
  scalar directly should switch to `seq.timeSignature.numerator`.
- **`parseTicks`** signature widened: its third parameter is now
  `TimeSignature` instead of `number`. Public-facing usage is unchanged
  because the sequencer normalises before calling.

### Documented (was load-bearing but undocumented before 0.24)

- `seq.on("step", ...)` event semantics (only fires when `stepSize`
  is configured).
- `seq.clearTracks()`, `seq.removeTrack(instrument)`.
- `SequencerNote.chance` field (per-pass probability gate).
- `SmplrPreset.defaults` block (`detune`, `reverse`, `ampRelease`,
  `lpfCutoffHz`, `loop`).
- `SmplrPreset.samples.map` per-sample URL override.
- `SmplrGroup.seqLength`, `SmplrRegion.seqPosition` round-robin fields.

## 0.23.0

### Changed (breaking)

- **`SmplrJson` renamed to `SmplrPreset`.** The type re-export from the
  package barrel uses the new name; the old name is not aliased. Update
  imports: `import { type SmplrPreset } from "smplr"`.
- **Public converters renamed: `*ToSmplrJson` → `*ToPreset`.** Affects
  `samplerToSmplrJson`, `pianoToSmplrJson`, `drumMachineToSmplrJson`,
  `mellotronToSmplrJson`, `sf2InstrumentToSmplrJson`,
  `soundfontToSmplrJson`. All drop the `Smplr` prefix in addition.
  Mechanical rename: `samplerToSmplrJson` → `samplerToPreset`, etc.

### Added

- **`Sampler` accepts `{ preset: SmplrPreset }`** as an alternate
  construction mode for full-schema input — per-region pitch/velocity/
  round-robin support without leaving the `Sampler` factory.
- **`sampler.reload(input)`** swaps content at runtime. Accepts either a
  flat buffers record (same shape as the construction `buffers` field) or a
  `SmplrPreset`. Useful for drum-machine / step-sequencer consumers that
  mutate samples in response to UI changes.
- **`SamplerReloadInput`** type exported for typing reload-input variables.
- **`PRESET_SCHEMA.md`** reference doc covering the full `SmplrPreset`
  schema (top-level shape, `PlaybackParams`, `SmplrGroup`, `SmplrRegion`,
  inheritance rules, worked examples). AUTHORING.md's schema section now
  links here instead of duplicating the table. (Renamed from
  `SMPLR_PRESET.md` in 0.26.0.)

### Fixed

- **`Smplr.loadInstrument` performs atomic state swaps and serializes
  concurrent calls (latest wins).** Previously the matcher swapped
  synchronously while buffers swapped asynchronously, so notes scheduled
  during the load window could silently drop. Concurrent calls also raced
  unpredictably — the slower-to-resolve `.then` won regardless of call order.
- **`Smplr.loadInstrument` clears the reversed-buffer cache on every swap.**
  Previously, reloading content under a sample name that re-used a name from
  a prior load (e.g. drum-kit swaps with consistent `"kick"`/`"snare"`
  naming) with `reverse: true` set would play the stale reversed buffer.

## 0.22.0

If you only ever followed the README, **no migration should be required**.

### New

- **`output.volume` getter/setter** on the channel. `instrument.output.volume = 80`
  is now the canonical way to change volume; `output.volume` reads the current
  value.
- **`output.setEffectMix(name, mix)`** on the channel. Replaces the old
  `output.sendEffect(name, mix)` as the canonical name; the old name is kept
  as a deprecated alias.
- **`instrument.dispose()`** — stops all voices, tears down the audio graph,
  and stops the scheduler. Becomes the canonical terminal-cleanup method;
  `disconnect()` stays as a deprecated alias.
- **`instrument.getCC(cc)`** — reads the latest value set via `setCC`. Defaults
  to `0` for any CC that hasn't been set.
- **Post-dispose safety**: calling `start`, `stop`, `setCC`, `getCC`,
  or `loadInstrument` on a disposed instrument throws a
  clear error instead of silently no-opping.
- **`SmplrJson.smplr?: "1.0"`** — optional schema version field on the JSON
  descriptor. Reserved for future migrations; safe to omit.
- **Same-named instance types for every factory** — each of `Sampler`,
  `Soundfont`, `SplendidGrandPiano`, `DrumMachine`, `ElectricPiano`, `Mallet`,
  `Mellotron`, `Smolken`, `Versilian`, `Soundfont2Sampler` is now exported as
  both a value (the factory) and a TypeScript type (the instance). This
  restores the pre-0.21 ergonomic of writing
  `useState<Sampler | undefined>(undefined)` without reaching for
  `ReturnType<typeof Sampler>`.

### Deprecated (still works in 1.x)

- **`output.setVolume(n)`** — `@deprecated` in TSDoc. Use `output.volume = n`.
- **`output.sendEffect(name, mix)`** — `@deprecated`. Use `output.setEffectMix(name, mix)`.
- **`instrument.disconnect()`** — `@deprecated`. Use `instrument.dispose()`.
  `disconnect()` continues to call into the same teardown.
- **`instrument.load`** (carried from 0.21.0) — `@deprecated`. Use `instrument.ready`.

### Removed

- **`spreadKeyRanges` and `SpreadResult`** are no longer exported from the
  public API. They were undocumented utilities used internally; if you depended
  on them, copy the implementation from `src/smplr/utils.ts`.

### Internal-only (no public export change, JSDoc tagged)

- `sfzToSmplrJson`, `toMidi`, `findNearestMidi` are now explicitly tagged
  `@internal`. They were never publicly exported; this clarifies their status
  for tooling and future contributors.

## 0.21.0

If you only ever followed the README, **no migration should be required**.

### New: defining instruments with `Instrument(...)`

The `Instrument` builder is the supported way to define an instrument from now on — both for the first-party instruments (already migrated internally) and for third-party packages.

```ts
import { Instrument } from "smplr";

export const MySynth = Instrument((ctx, opts, smplr) => {
  return loadSamples(opts).then(({ json, buffers }) => {
    smplr.loadInstrument(json, buffers);
  });
});
```

See the new [Defining an instrument](./AUTHORING.md) guide for the full third-party authoring story, including the sync vs async patterns and the `SmplrPlugin<O, E>` type for extracting plugins to named variables.

### New: `Smplr` as a TypeScript interface

`Smplr` is now exported as a TypeScript **interface** describing an instrument instance:

```ts
import type { Smplr } from "smplr";

function playChord(inst: Smplr, notes: string[]) {
  /* … */
}
```

Use it in function signatures, generic helpers, and JSDoc. It is not a class and cannot be constructed.

### New: factories are callable without `new`

Every first-party factory (`SplendidGrandPiano`, `Soundfont`, `DrumMachine`, `ElectricPiano`, `Mallet`, `Mellotron`, `Smolken`, `Versilian`, `Sampler`, `Soundfont2Sampler`) supports both `X(ctx, opts)` and `new X(ctx, opts)`. The call form is the documented one going forward; the `new` form is preserved and marked `@deprecated` at the TypeScript level so editors steer new code toward the call form.

### New: `instrument.ready` field

Every instrument now exposes a `readonly ready: Promise<void>` that resolves when the instrument is loaded. Prefer it over `.load` in new code:

```ts
const piano = SplendidGrandPiano(context);
await piano.ready;
piano.start({ note: "C4" });
```

`.load` is kept as a deprecated alias that still resolves to the instrument (`await new X(ctx).load` works unchanged).

### Removed

- **`Smplr` (class)** — was exported from `smplr` but never documented. `new Smplr(...)` produces a TypeScript error and a runtime error. See the migration recipe below if you were using it.
- **Deprecated runtime aliases on first-party instruments** — `Sampler.loaded()`, `SplendidGrandPiano.loaded()`, `Soundfont.loaded()`, `DrumMachine.loaded()`, `DrumMachine.sampleNames` getter, `DrumMachine.getVariations()`. All printed a deprecation warning and were unreachable from the README. Use `.load` / `.ready` and the documented extras (`getGroupNames`, `getSampleNamesForGroup`) instead.
- **Undocumented fields** — `Soundfont.config`, `Soundfont.hasLoops`, `Soundfont2Sampler.options`, `Soundfont2Sampler.soundfont`. All were internal state that leaked into the public type; none are referenced by the README, the demo site, or any test.

### Deprecated (still works in 0.21.x and 1.x)

- **`new X(ctx, opts)` on any first-party factory** — `@deprecated` at the TypeScript level only. Runtime behavior is unchanged: `new SplendidGrandPiano(ctx)` still returns a fully constructed instance. Editors will steer you toward the call form `SplendidGrandPiano(ctx)`.
- **`instrument.load`** — `@deprecated` in TSDoc. Use `await instrument.ready` to await load completion (resolves to `void`); the `load` getter still resolves to the instrument for compatibility with `const piano = await new SplendidGrandPiano(ctx).load`.
- **`instrument.output.setVolume(n)` and `instrument.output.sendEffect(name, mix)`** — both continue to work with no runtime warning and no TSDoc deprecation tag yet. They will be marked `@deprecated` once the replacement APIs (`output.volume = n`, `output.setEffectMix(name, mix)`) ship under the upcoming OutputChannel cleanup.

### Migrating `new Smplr(...)`

If you reached for the (undocumented) `Smplr` class export — for example to author a custom instrument inline — switch to `Instrument(...)`:

```ts
// Before:
import { Smplr } from "smplr";
const inst = new Smplr(ctx, jsonInstrument);
await inst.load;

// After:
import { Instrument } from "smplr";
const Custom = Instrument((ctx, _opts, smplr) =>
  smplr.loadInstrument(jsonInstrument),
);
const inst = Custom(ctx, {});
await inst.ready;
```

For the typical case (an instrument you want to use _now_, not export as a reusable factory), `Sampler` covers the inline-instrument use case.

### Stability — 1.0 candidate

Everything documented in [README.md](./README.md), in [AUTHORING.md](./AUTHORING.md), and in the public TypeScript surface (`dist/index.d.ts`) is intended to ship unchanged into 1.0. The remaining 1.0 work is a coordinated set of sibling tickets:

- narrow public interfaces for `loader` and `scheduler` (currently concrete classes)
- metadata exports (`getSoundfontNames` etc.) as tree-shakable standalone functions
- `OutputChannel` cleanup: `output.volume` getter/setter, `output.setEffectMix(name, mix)` rename
- forward-compatible `SmplrJson` schema with a `version` field and validator

When those four ship, the next release bumps to 1.0.0 and the deprecation tags on `setVolume`/`sendEffect` land alongside their replacements.

## 0.20.0

### Export Audio (offline rendering)

Render audio offline and export as WAV — faster than real-time, no speakers needed:

```ts
import { renderOffline, SplendidGrandPiano } from "smplr";

const result = await renderOffline(async (context) => {
  const piano = await new SplendidGrandPiano(context).load;
  piano.start({ note: "C4", time: 0, duration: 1 });
  piano.start({ note: "E4", time: 0.5, duration: 1 });
});

result.downloadWav("export.wav");
```

`renderOffline` returns a `RenderResult` with:

- `audioBuffer` — raw `AudioBuffer`
- `toWav()` / `toWav16()` — encode as 32-bit or 16-bit WAV `Blob`
- `downloadWav(filename?)` / `downloadWav16(filename?)` — one-liner file download

Duration is auto-detected (trailing silence trimmed), or pass it explicitly:

```ts
const result = await renderOffline(callback, {
  duration: 10,
  sampleRate: 48000,
});
```

For bug reports, paste this in any browser console — no install needed:

```js
const { renderOffline, SplendidGrandPiano } =
  await import("https://esm.sh/smplr");
const result = await renderOffline(async (ctx) => {
  const piano = await new SplendidGrandPiano(ctx).load;
  piano.start({ note: "C4", time: 0, duration: 1 });
});
result.downloadWav16("bug-report.wav");
```

### Other changes

- `Smplr` context type relaxed from `AudioContext` to `BaseAudioContext` for `OfflineAudioContext` compatibility
- Duration auto-stop now uses audio-time scheduling instead of `setTimeout` (works in both real-time and offline contexts)
- Updated devDependencies to fix all known vulnerabilities

## 0.19.0

#### Pan

Stereo panning is now built into every instrument's output channel. Set it at construction time or at runtime:

```ts
const drums = new DrumMachine(context, { pan: -0.5 }); // slightly left
drums.output.pan = 0.8; // right
drums.output.pan = 0; // centre
```

`pan` accepts a value from `-1` (full left) to `+1` (full right). Default is `0` (centre).

#### Probabilistic steps (`chance` on `SequencerNote`)

Add a `chance` field (0–100, default 100) to any sequencer note. The probability is re-rolled on every loop pass:

```ts
seq.addTrack(drums, [
  { note: "kick", at: "1:1" },
  { note: "hihat", at: "1:1", chance: 50 }, // fires ~50 % of the time
  { note: "hihat", at: "1:3", chance: 75 },
]);
```

#### Reverse playback

Play a sample backwards by setting `reverse: true` on a note event:

```ts
drums.start({ note: "cymbal", reverse: true });
```

The reversed buffer is created lazily on first use and cached — subsequent calls reuse it with no extra allocation.

#### Step event on `Sequencer`

`sequencer.on("step", (stepIndex, time) => ...)` fires at each grid subdivision. Enable it with the `stepSize` constructor option:

```ts
const seq = new Sequencer(context, {
  bpm: 120,
  loop: true,
  stepSize: "16n",
});

seq.on("step", (stepIndex, time) => {
  const delay = (time - context.currentTime) * 1000;
  setTimeout(() => ui.highlightStep(stepIndex % 16), delay);
});
```

#### Minor Changes

- Export `Smplr` class and all core types (`SmplrJson`, `SmplrGroup`, `SmplrRegion`, `PlaybackParams`, etc.) from the package root. Rename sequencer's `NoteEvent` to `SequencerNoteEvent` to avoid the name collision.

## 0.18.x

- Minor Sequencer fixes and code cleanup

#### New Sequencer

A timing-correct, multi-track `Sequencer` that delegates audio scheduling to instruments
via `instrument.start({ note, time })`.

```ts
import { Sequencer, SplendidGrandPiano } from "smplr";

const seq = new Sequencer(context, { bpm: 120, loop: true });
seq.addTrack(piano, [
  { note: "C4", at: "1:1", duration: "4n" },
  { note: "E4", at: "1:2", duration: "4n" },
]);
seq.loopEnd = "2:1";
seq.start();
```

Features:

- **Multi-track**: `addTrack(instrument, notes)` / `removeTrack` / `clearTracks`
- **Musical time notation**: `"4n"`, `"8n"`, `"1m"`, `"2:1"`, `"1:1:48"`, dotted (`"4n."`)
- **Playback**: `start` / `pause` / `stop` with seamless resume
- **Live BPM changes**: set `bpm` mid-playback with no rescheduling needed
- **Seek**: set `position` to jump to any bar/beat/tick while playing
- **Loop**: configurable `loopStart` / `loopEnd` / `progress`
- **Pattern API**: `scheduleRepeat(callback, interval)` for programmatic patterns
- **Events**: `beat`, `bar`, `loop`, `end`, `start`, `stop`, `pause`
- **Humanize**: optional random timing/velocity offsets

#### Sequencer `noteOn` / `noteOff` events

The Sequencer emits `noteOn` and `noteOff` events driven by the instrument's own
`onStart` / `onEnded` callbacks — they fire at actual playback time, not at scheduling time:

```ts
seq.on("noteOn", (event) => highlight(event.noteId));
seq.on("noteOff", (event) => unhighlight(event.noteId));
```

The event (`NoteEvent`) contains `noteId`, `trackIndex`, `noteIndex`, and the original
`SequencerNote`. Notes can have a custom `id` field; otherwise `noteId` defaults to the
array index.

#### AudioWorklet graceful degradation

`Reverb` now checks for `context.audioWorklet` before calling `addModule()`. On iPad Safari
over HTTP (non-secure context), `audioWorklet` is `undefined` — the reverb now degrades
gracefully (no effect, no crash) instead of throwing.

## 0.17.x

- Migrate Piano sample sources to smpldsnds (fix a iOS loading problem)

#### New audio player (`src/smplr/`)

Complete rewrite of the audio playback layer with full unit test coverage. All nine instruments
are migrated to the new player. The public `start` / `stop` / `disconnect` / `output` / `load`
interface is unchanged.

#### Per-note `onStart` / `onEnded` callbacks

Callbacks can now be set globally on instrument options and/or per-note on the event object.
Both levels are composed when set together:

```ts
const piano = new SplendidGrandPiano(context, {
  onStart: (event) => console.log("started", event.note),
  onEnded: (event) => console.log("ended", event.note),
});

// or per note
piano.start({
  note: "C4",
  onStart: (e) => console.log("note on", e.note),
  onEnded: (e) => console.log("note off", e.note),
});
```

#### Load progress

`onLoadProgress` callback and `loadProgress` getter are now available on every instrument.
The total sample count is known before loading starts, enabling determinate progress bars:

```ts
const piano = new SplendidGrandPiano(context, {
  onLoadProgress: ({ loaded, total }) => {
    console.log(`Loading… ${loaded} / ${total}`);
  },
});

await piano.load;
console.log(piano.loadProgress); // { loaded: N, total: N }
```

#### Sampler accepts pre-decoded `AudioBuffer` values

```ts
const sampler = new Sampler(context, {
  buffers: {
    C4: myAudioBuffer, // AudioBuffer
    D4: "https://…/D4.mp3", // URL string still works
  },
});
```

#### Shared `Scheduler` and `SampleLoader`

Multiple instruments can share a `Scheduler` for coordinated timing and a `SampleLoader` for
buffer cache reuse:

```ts
import { Scheduler, SampleLoader } from "smplr";

const scheduler = new Scheduler(context);
const loader = new SampleLoader(context);

const piano = new SplendidGrandPiano(context, { scheduler, loader });
const bass = new Smolken(context, { scheduler, loader });
```

#### Advanced region features (SFZ-based instruments)

- **MIDI CC range matching** (`ccRange`) — gates regions on sustain-pedal or other CC values
- **Velocity curve** (`ampVelCurve`) — per-region amplitude scaling
- **Exclusive groups / off-by** — voice stealing between groups
- **Round-robin sequencing** (`seqPosition` / `seqLength`) — cycle through sample variations
- **Trigger modes** (`trigger: "first" | "legato"`) — region-level note trigger filtering

#### Breaking changes

- `Soundfont2Sampler`: the public `player` property (a `RegionPlayer` instance) is removed.
  Use `output`, `start`, and `stop` instead.

## 0.16.x

#### Safari bug fixes

- Fix Safari audio decoding by skipping OGG format and using MP3/M4A fallback.
- Add error handling for individual note decoding failures in Soundfont.

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
