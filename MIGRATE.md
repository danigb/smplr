# Migrating smplr

`smplr` is approaching 1.0. Pre-1.0 API work began in 0.22.0 and lands its final batch in 0.26.0 — every documented `new X(ctx, opts)` keeps working, and the documented surface is intended to ship unchanged into 1.0. The formal stability commitment lands once the narrow `loader`/`scheduler` public interfaces sibling ticket is in (see [CHANGELOG](https://github.com/danigb/smplr/blob/main/CHANGELOG.md)).

> **TL;DR for upgrading from an earlier 0.x:** No code changes are required — every documented `new X(ctx, opts)` keeps working. New code should drop the `new` (`X(ctx, opts)`) and prefer `await x.ready` over `await x.load`.

## Deprecated aliases

Every alias below continues to work; editors will mark the old form as `@deprecated` to nudge new code toward the new form.

| Old                            | New                                   | Notes                                                                      |
| ------------------------------ | ------------------------------------- | -------------------------------------------------------------------------- |
| `new SplendidGrandPiano(ctx)`  | `SplendidGrandPiano(ctx)`             | Same for every instrument factory.                                         |
| `new Sequencer(ctx, opts)`     | `Sequencer(ctx, opts)`                |                                                                            |
| `await x.load`                 | `await x.ready`                       | `.load` resolves to the instance; `.ready` to `void`. Both stay supported. |
| `output.setVolume(n)`          | `output.volume = n`                   | Getter/setter form.                                                        |
| `output.sendEffect(name, mix)` | `output.addEffect(name, effect, mix)` |                                                                            |
| `disconnect()`                 | `dispose()`                           |                                                                            |
| `Soundfont2Sampler`            | `Soundfont2`                          | Class renamed.                                                             |

## Removed APIs

- **`loaded()`** (pre-0.8.0) — replaced by the `.load` property (and now `.ready`). If you're on `< 0.8`, update those call sites before upgrading further.

## Versioning policy

The documented surface above is intended to ship unchanged into 1.0. See [CHANGELOG](https://github.com/danigb/smplr/blob/main/CHANGELOG.md) for per-release detail.
