# Defining an instrument

[← back to README](./README.md)

`smplr` ships ten instruments out of the box — `SplendidGrandPiano`, `Soundfont`, `DrumMachine`, `ElectricPiano`, `Mallet`, `Mellotron`, `Smolken`, `Versilian`, `Sampler`, `Soundfont2Sampler`. If none of them fit your use case, you can author your own with the `Instrument` builder.

An instrument is a function `(ctx, options, smplr) => …` that runs once when the instrument is created. It can:

- load audio (return a `Promise<void>` and the instrument's `ready` field will await it),
- add effects to the output channel (call `smplr.output.addInsert(...)` or `smplr.output.addEffect(...)`),
- return extra methods to merge onto the instance (e.g. `{ getSampleNames: () => [...] }`).

## A simple instrument (async load, no extras)

```ts
import { Instrument } from "smplr";

interface MyPianoOptions {
  url?: string;
}

export const MyPiano = Instrument((ctx, options: MyPianoOptions, smplr) => {
  // Returning the Promise<void> makes `instrument.ready` await it.
  return fetch(options.url ?? "https://example.com/my-piano.json")
    .then((r) => r.json())
    .then((json) => smplr.loadInstrument(json));
});

const ctx = new AudioContext();
const piano = MyPiano(ctx, { url: "https://example.com/my-piano.json" });
await piano.ready;
piano.start({ note: "C4" });
```

## An instrument with extras

When a plugin needs to expose extra methods alongside the standard `Smplr` surface, return `{ extras, ready }`. The extras object is merged onto the instance synchronously, so the methods are callable before `await ready` resolves.

```ts
import { Instrument } from "smplr";

interface MyDrumsOptions {
  url: string;
}

export const MyDrums = Instrument((ctx, options: MyDrumsOptions, smplr) => {
  let sampleNames: string[] = [];

  const ready = fetch(options.url)
    .then((r) => r.json())
    .then((json) => {
      sampleNames = json.samples.map((s: { name: string }) => s.name);
      return smplr.loadInstrument(json);
    });

  return {
    extras: { getSampleNames: () => sampleNames.slice() },
    ready,
  };
});

const ctx = new AudioContext();
const drums = MyDrums(ctx, { url: "https://example.com/drums.json" });
await drums.ready;
console.log(drums.getSampleNames()); // typed extras, no cast
```

## Authoring a third-party package

Publish your `Instrument(...)` call from your package's entry point:

```ts
// my-instrument/src/index.ts
import { Instrument, type SmplrPlugin } from "smplr";

export interface MyInstrumentOptions {
  /* … */
}
export interface MyInstrumentExtras {
  /* … */
}

const plugin: SmplrPlugin<MyInstrumentOptions, MyInstrumentExtras> = (
  ctx,
  options,
  smplr,
) => {
  // Inside the plugin, `smplr.loadInstrument(json, buffers?)` is available.
  // The instance your users receive does *not* expose this method by default —
  // they call your factory and you do the loading internally. Factories that
  // want to support runtime content swaps add a method via extras (see
  // `Sampler.reload` and `Soundfont2Sampler.loadInstrument` for the two
  // existing examples).
  // …
};

export const MyInstrument = Instrument(plugin);
```

Your users then write:

```ts
import { MyInstrument } from "my-instrument";

const ctx = new AudioContext();
const inst = MyInstrument(ctx, {
  /* MyInstrumentOptions */
});
await inst.ready;
```

The factory returned by `Instrument(...)` supports both call and construct forms — `new MyInstrument(ctx, opts)` also works, so users migrating from earlier versions of `smplr` keep their `new` syntax.

## The `Smplr` interface

`Smplr` is exported as a TypeScript **interface** describing what every instrument instance has in common. Use it to type generic helpers:

```ts
import { type Smplr } from "smplr";

function playChord(inst: Smplr, notes: string[], duration = 1) {
  notes.forEach((note) => inst.start({ note, duration }));
}
```

The interface lists the shared surface: `start`, `stop`, `setCC`, `getCC`, `dispose`, `output`, `loader`, `scheduler`, `ready`, `load`, `loadProgress`, `context`. Instrument-specific extras (`tremolo`, `getSampleNames`, `loadInstrument(name)`, …) are _not_ on `Smplr` itself — accept the specific instrument type when you need them.

`Smplr` is a type, not a class — `new Smplr(...)` won't compile. Use `Instrument(...)` to author an instrument; use the factories `SplendidGrandPiano(ctx)`, `Soundfont(ctx, opts)`, etc. to create one.

## SmplrPreset schema

`SmplrPreset` is the descriptor that drives sample selection, region matching, and playback. See [SMPLR_PRESET.md](./SMPLR_PRESET.md) for the full schema reference (top-level shape, `PlaybackParams`, `SmplrGroup`, `SmplrRegion`, inheritance rules, and worked examples).

The canonical type definition lives in `src/smplr/types.ts`.
