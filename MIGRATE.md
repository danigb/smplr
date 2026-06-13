# Migrating smplr

`smplr` 1.0.0 is the first stable release. Pre-1.0 API work began in 0.22.0; every documented `new X(ctx, opts)` keeps working, and the documented surface is now frozen for the 1.x line (see [CHANGELOG](https://github.com/danigb/smplr/blob/main/CHANGELOG.md)).

> **TL;DR for upgrading from an earlier 0.x:** No code changes are required — every documented `new X(ctx, opts)` keeps working. New code should drop the `new` (`X(ctx, opts)`) and prefer `await x.ready` over `await x.load`.

## Deprecated aliases

Every alias below continues to work; editors will mark the old form as `@deprecated` to nudge new code toward the new form.

| Old                            | New                                     | Notes                                                                      |
| ------------------------------ | --------------------------------------- | -------------------------------------------------------------------------- |
| `new SplendidGrandPiano(ctx)`  | `SplendidGrandPiano(ctx)`               | Same for every instrument factory.                                         |
| `new Sequencer(ctx, opts)`     | `Sequencer(ctx, opts)`                  |                                                                            |
| `await x.load`                 | `await x.ready`                         | `.load` resolves to the instance; `.ready` to `void`. Both stay supported. |
| `output.setVolume(n)`          | `output.volume = n`                     | Getter/setter form.                                                        |
| `output.sendEffect(name, mix)` | `output.addEffect(name, effect, mix)`   |                                                                            |
| `disconnect()`                 | `dispose()`                             |                                                                            |
| `Soundfont2Sampler`            | `Soundfont2`                            | Class renamed.                                                             |
| `loader.load(json, fn)`        | `loader.load(json, { onProgress: fn })` | Pass an options object. Bare-callback form still works.                    |

## 1.0.0 contract changes

These affect custom `SmplrPreset` authors. No bundled instrument is affected.

| Change                                                           | What to do                                                                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **`offset` is now in seconds** (was sample frames).              | Divide any old frame value by the sample rate (e.g. `44100` → `1.0`).                                                           |
| **`loopStart` / `loopEnd` are documented as seconds.**           | No change — the player already treated them as seconds. For a fraction of the buffer, use `loopAuto: { startRatio, endRatio }`. |
| **`SmplrRegion.ampVelCurve` removed.**                           | It never affected playback (dead field). Remove it from presets; it was a no-op.                                                |
| **`Soundfont2.loadInstrument(name)` throws on an unknown name.** | Was silently returning `undefined`. Wrap in try/catch if you pass untrusted names.                                              |

## Removed APIs

- **`loaded()`** (pre-0.8.0) — replaced by the `.load` property (and now `.ready`). If you're on `< 0.8`, update those call sites before upgrading further.

## Versioning policy

The documented surface above is intended to ship unchanged into 1.0. See [CHANGELOG](https://github.com/danigb/smplr/blob/main/CHANGELOG.md) for per-release detail.
