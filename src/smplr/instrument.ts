import type { OutputChannel } from "./channel";
import type { SampleLoader } from "./sample-loader";
import type { Scheduler } from "./scheduler";
import { SmplrImpl, type SmplrOptions } from "./smplr";
import type {
  LoadProgress,
  NoteEvent,
  SmplrJson,
  StopFn,
  StopTarget,
} from "./types";

/**
 * Public Smplr interface — the type plugin authors, helper functions, and
 * users program against. Mirrors the surface of the underlying SmplrImpl
 * class, minus internal helpers.
 *
 * `loadInstrument` is intentionally *not* on this interface — it's the
 * plugin-side API, exposed via {@link PluginSmplr} to plugin bodies only.
 */
export interface Smplr {
  readonly context: BaseAudioContext;

  /** Resolves when the instrument is ready to play. Preferred over `load`. */
  readonly ready: Promise<void>;

  /**
   * @deprecated Use `ready` instead. Returns a Promise that resolves to the
   * instrument for compatibility with `const x = await new X(ctx).load`.
   */
  readonly load: Promise<Smplr>;

  readonly output: OutputChannel;

  /** Shared with other instruments via SmplrOptions.loader. */
  readonly loader: SampleLoader;

  /** Shared with other instruments via SmplrOptions.scheduler. */
  readonly scheduler: Scheduler;

  readonly loadProgress: LoadProgress;

  start(event: NoteEvent): StopFn;
  stop(target?: StopTarget): void;
  setCC(cc: number, value: number): void;
  disconnect(): void;
}

/**
 * Plugin-facing widening of {@link Smplr} that exposes `loadInstrument` —
 * the primary plugin → smplr API for wiring an async-loaded JSON.
 *
 * This interface is *not* exported from the package barrel. Plugin authors
 * receive it as the third argument to their {@link SmplrPlugin}.
 */
export interface PluginSmplr extends Smplr {
  /**
   * Replace the current instrument JSON and re-fetch buffers. Pre-decoded
   * buffers (e.g. base64-decoded from a soundfont) can be passed via the
   * `buffers` parameter.
   *
   * Resolves when all samples are ready.
   */
  loadInstrument(
    json: SmplrJson,
    buffers?: Map<string, AudioBuffer>
  ): Promise<void>;
}

/**
 * Permitted return shapes for an {@link SmplrPlugin}:
 *
 * - `void` — sync plugin, no async load, no extras
 * - `Promise<void>` — async load, no extras
 * - `E` — sync extras, no async load
 * - `{ extras: E; ready: Promise<void> }` — sync extras + async load
 * - `{ ready: Promise<void> }` — async load, no extras (explicit form)
 *
 * Extras keys are merged onto the smplr instance via `Object.assign` and
 * may shadow base {@link Smplr} methods (e.g. DrumMachine overrides `start`
 * to inject `stopId: sample.note`).
 */
export type SmplrPluginResult<E extends object> =
  | void
  | Promise<void>
  | E
  | { extras: E; ready: Promise<void> }
  | { ready: Promise<void> };

/**
 * Plugin signature. Receives the audio context, the user options (with
 * SmplrOptions keys already stripped by the {@link Instrument} builder),
 * and a {@link PluginSmplr} the plugin can wire up.
 */
export type SmplrPlugin<O, E extends object = {}> = (
  ctx: BaseAudioContext,
  options: O,
  smplr: PluginSmplr
) => SmplrPluginResult<E>;

/**
 * The dual call/construct factory produced by {@link Instrument}. Callable
 * without `new` (preferred) or with `new` (kept for compatibility with
 * pre-1.0 examples).
 */
export type InstrumentFactory<O, E extends object = {}> = {
  (ctx: BaseAudioContext, options: O & Partial<SmplrOptions>): Smplr & E;

  /**
   * @deprecated Call as a function: `MyInstrument(ctx, opts)` instead of
   * `new MyInstrument(...)`. Kept for compatibility with pre-1.0 examples.
   */
  new (ctx: BaseAudioContext, options: O & Partial<SmplrOptions>): Smplr & E;
};

const SMPLR_OPTION_KEYS = [
  "storage",
  "destination",
  "volume",
  "volumeToGain",
  "pan",
  "velocity",
  "loader",
  "scheduler",
  "onLoadProgress",
  "onStart",
  "onEnded",
] as const;

function splitOptions<O>(
  options: O & Partial<SmplrOptions>
): { smplrOpts: SmplrOptions; pluginOpts: O } {
  const smplrOpts: Record<string, unknown> = {};
  const pluginOpts: Record<string, unknown> = { ...(options as Record<string, unknown>) };
  for (const key of SMPLR_OPTION_KEYS) {
    if (key in pluginOpts) {
      smplrOpts[key] = pluginOpts[key];
      delete pluginOpts[key];
    }
  }
  return { smplrOpts: smplrOpts as SmplrOptions, pluginOpts: pluginOpts as O };
}

function isPromise(x: unknown): x is Promise<unknown> {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { then?: unknown }).then === "function"
  );
}

/**
 * Builder for smplr instruments. Wraps a plugin function into a dual
 * call/construct factory that produces ready-to-play {@link Smplr} instances
 * augmented with plugin extras.
 *
 * ```ts
 * type MyOptions = { instrument: string };
 *
 * export const MyInstrument = Instrument<MyOptions>((ctx, options, smplr) => {
 *   return smplr.loadInstrument(fetchJson(options.instrument));
 * });
 *
 * const inst = MyInstrument(ctx, { instrument: "piano", volume: 80 });
 * await inst.ready;
 * inst.start("C4");
 * ```
 */
export function Instrument<O, E extends object = {}>(
  plugin: SmplrPlugin<O, E>
): InstrumentFactory<O, E> {
  function factory(
    ctx: BaseAudioContext,
    options: O & Partial<SmplrOptions>
  ): Smplr & E {
    const { smplrOpts, pluginOpts } = splitOptions(
      options ?? ({} as O & Partial<SmplrOptions>)
    );
    const smplr = new SmplrImpl(ctx, smplrOpts);
    const result: unknown = plugin(ctx, pluginOpts, smplr);

    let readyPromise: Promise<void> = Promise.resolve();

    if (result != null) {
      if (isPromise(result)) {
        readyPromise = result.then((resolved: unknown) => {
          if (resolved && typeof resolved === "object") {
            Object.assign(smplr, resolved);
          }
        });
      } else if (typeof result === "object") {
        const maybe = result as { extras?: object; ready?: Promise<void> };
        if (isPromise(maybe.ready)) {
          if (maybe.extras) Object.assign(smplr, maybe.extras);
          readyPromise = maybe.ready;
        } else {
          // Plain sync extras (E)
          Object.assign(smplr, result);
        }
      }
    }

    smplr._setReady(readyPromise);
    return smplr as unknown as Smplr & E;
  }

  return factory as unknown as InstrumentFactory<O, E>;
}
