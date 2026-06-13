# `SmplrPreset` schema

[← back to README](./README.md) · [AUTHORING](./AUTHORING.md)

`SmplrPreset` is the descriptor that drives sample selection, region matching, and playback. It is the canonical input to `smplr.loadInstrument(preset)` (plugin-side) and to `Sampler(ctx, { preset })` / `sampler.reload(preset)` (public API). All first-party instruments produce a `SmplrPreset` internally and call `loadInstrument` with it.

The canonical TypeScript definitions live in [`src/smplr/types.ts`](./src/smplr/types.ts). This document is the reference for the preset shape.

## Version field

```ts
type SmplrPreset = {
  smplr?: "1.0";
  /* … */
};
```

`smplr` is the schema-version field. Omit for the current format. The field is reserved for future migrations — when a future revision changes shape, the version string lets the loader decide whether to migrate or refuse.

## Top-level shape

| Field      | Type                                | Description                                                             |
| ---------- | ----------------------------------- | ----------------------------------------------------------------------- |
| `smplr`    | `"1.0"` (optional)                  | Schema version. Omit for the current format.                            |
| `meta`     | object (optional)                   | Display metadata — see below.                                           |
| `samples`  | `SmplrSamples`                      | Sample manifest (`baseUrl`, `formats`, optional `map`).                 |
| `defaults` | `PlaybackParams` (optional)         | Playback defaults applied to every region (inherited; overridable).     |
| `groups`   | `SmplrGroup[]`                      | Region groups (velocity layers, round-robin, key/CC ranges).            |
| `aliases`  | `Record<string, number>` (optional) | Maps arbitrary string keys to MIDI numbers, resolved before `toMidi()`. |

## `meta`

| Field         | Type       | Description                                  |
| ------------- | ---------- | -------------------------------------------- |
| `name`        | `string`   | Display name.                                |
| `description` | `string`   | Short prose description.                     |
| `license`     | `string`   | License identifier or URL.                   |
| `source`      | `string`   | Origin URL (sample pack page, GitHub, etc.). |
| `tags`        | `string[]` | Free-form tags.                              |

All fields optional. `meta` is informational — the loader does not consume it.

## `samples` (`SmplrSamples`)

| Field     | Type                                | Description                                                                                     |
| --------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `baseUrl` | `string`                            | Prepended to all sample paths.                                                                  |
| `formats` | `string[]`                          | Audio formats in preference order. The first browser-supported format wins via codec detection. |
| `map`     | `Record<string, string>` (optional) | Sample-name → relative-path indirection (without extension).                                    |

The resolved fetch URL is `${baseUrl}/${region.sample}.${chosenFormat}`, or `${baseUrl}/${samples.map[region.sample]}.${chosenFormat}` when `map` is present.

## `PlaybackParams`

Inheritable playback parameters. Can appear at `defaults`, group, or region level. More specific levels override less specific ones.

| Field         | Type      | Description                                                             |
| ------------- | --------- | ----------------------------------------------------------------------- |
| `volume`      | `number`  | dB adjustment (0 = no change).                                          |
| `tune`        | `number`  | Pitch adjustment in semitones.                                          |
| `detune`      | `number`  | Fine pitch adjustment in cents.                                         |
| `ampRelease`  | `number`  | Release envelope time in seconds.                                       |
| `ampAttack`   | `number`  | Attack time in seconds. _(Not yet implemented — accepted but ignored.)_ |
| `lpfCutoffHz` | `number`  | Low-pass filter cutoff frequency in Hz.                                 |
| `offset`      | `number`  | Start playback from this position in seconds.                           |
| `loop`        | `boolean` | Loop the sample.                                                        |
| `loopStart`   | `number`  | Loop start in seconds. (For a fraction of the buffer, use `loopAuto`.)  |
| `loopEnd`     | `number`  | Loop end in seconds (`0` means end of buffer).                          |
| `reverse`     | `boolean` | Play the sample backwards.                                              |

### Inheritance rules

For each playback parameter, the value resolves in order:

1. `region.<param>` (most specific)
2. `group.<param>`
3. `preset.defaults.<param>` (least specific)
4. Built-in default

Example: a region with `volume: -3` inside a group with `volume: 0` inside a preset with `defaults: { volume: 6 }` plays at `-3` dB.

## `SmplrGroup`

Groups of regions sharing common constraints and defaults.

| Field       | Type                               | Description                                                   |
| ----------- | ---------------------------------- | ------------------------------------------------------------- |
| `label`     | `string`                           | Optional display name.                                        |
| `keyRange`  | `[number, number]`                 | Group-level key-range filter.                                 |
| `velRange`  | `[number, number]`                 | Group-level velocity-range filter.                            |
| `ccRange`   | `Record<string, [number, number]>` | Group-level CC range filter (CC number → `[low, high]`).      |
| `seqLength` | `number`                           | Total number of round-robin variations in this group.         |
| `group`     | `number`                           | Exclusive group number for all regions in this group.         |
| `offBy`     | `number`                           | Triggering any region here stops voices in this group number. |
| `trigger`   | `"first" \| "legato"`              | Region-level note-trigger filtering.                          |
| `regions`   | `SmplrRegion[]`                    | Required.                                                     |

`SmplrGroup` also accepts every `PlaybackParams` field; those apply as group-level defaults inherited by its regions.

## `SmplrRegion`

An individual sample region. Maps a sample to a range of notes and velocities.

| Field         | Type                                       | Description                                                 |
| ------------- | ------------------------------------------ | ----------------------------------------------------------- |
| `sample`      | `string`                                   | Key in `samples.map` **or** relative path.                  |
| `key`         | `number`                                   | Shorthand: sets `keyRange=[key,key]` and `pitch=key`.       |
| `keyRange`    | `[number, number]`                         | `[low, high]` MIDI note range.                              |
| `pitch`       | `number`                                   | Root MIDI pitch of the sample (used to calculate detune).   |
| `velRange`    | `[number, number]`                         | `[low, high]` velocity range.                               |
| `ccRange`     | `Record<string, [number, number]>`         | CC number → `[low, high]` range.                            |
| `seqPosition` | `number`                                   | 1-based position in the round-robin sequence.               |
| `group`       | `number`                                   | Exclusive group membership.                                 |
| `offBy`       | `number`                                   | Triggering this stops voices in this group number.          |
| `trigger`     | `"first" \| "legato"`                      | Note-trigger filtering.                                     |
| `loopAuto`    | `{ startRatio: number; endRatio: number }` | Auto-compute loop points from buffer-relative ratios (0–1). |

`SmplrRegion` also accepts every `PlaybackParams` field; region values override the group and the preset defaults.

## `aliases`

`Record<string, number>` mapping arbitrary keys to MIDI numbers. Resolved before `toMidi()`, so `sampler.start({ note: "kick" })` works for drum-machine-style symbolic names.

## Round-robin & exclusive groups

- **Round-robin** (`seqLength` on the group, `seqPosition` on each region): on every match the engine advances a per-group counter (1 → `seqLength` → 1 → …) and plays the region whose `seqPosition` matches. Use it to cycle through hit variations.
- **Exclusive groups** (`group` + `offBy`): when a region with `offBy: N` triggers, any active voice belonging to `group: N` is stopped. Use it for hi-hat open/close pairs (set `group: 1` on the open hat region, `offBy: 1` on the close hat region).

## Format selection

`samples.formats: ["ogg", "mp3"]` resolves to the first browser-supported format via `loadAudioBuffer`'s codec detection. If none match, the first listed format is used as a fallback.

## Worked examples

### Simple drum kit

One group, exact-range regions per pad, symbolic names via `aliases`.

```ts
import type { SmplrPreset } from "smplr";

const drumKit: SmplrPreset = {
  meta: { name: "Mini 808" },
  samples: {
    baseUrl: "https://smpldsnds.github.io/drum-machines/808-mini/",
    formats: ["ogg", "m4a"],
  },
  aliases: { kick: 36, snare: 38, hihat: 42 },
  groups: [
    {
      regions: [
        { sample: "kick", keyRange: [36, 36], pitch: 36 },
        { sample: "snare-1", keyRange: [38, 38], pitch: 38 },
        { sample: "hihat-closed", keyRange: [42, 42], pitch: 42 },
      ],
    },
  ],
};
```

### Multi-velocity piano

Multiple groups partitioned by `velRange`, each group covering the full keyboard.

```ts
import type { SmplrPreset } from "smplr";

const piano: SmplrPreset = {
  meta: { name: "Demo Grand Piano" },
  samples: {
    baseUrl: "https://example.com/piano/",
    formats: ["ogg"],
  },
  defaults: { ampRelease: 0.5 },
  groups: [
    {
      label: "soft",
      velRange: [0, 63],
      regions: [
        { sample: "C4-p", keyRange: [55, 67], pitch: 60 },
        { sample: "C5-p", keyRange: [68, 79], pitch: 72 },
      ],
    },
    {
      label: "loud",
      velRange: [64, 127],
      regions: [
        { sample: "C4-f", keyRange: [55, 67], pitch: 60 },
        { sample: "C5-f", keyRange: [68, 79], pitch: 72 },
      ],
    },
  ],
};
```
