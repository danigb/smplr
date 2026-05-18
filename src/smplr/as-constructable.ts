/**
 * Wrap a class so it is callable both as `X(...)` (preferred) and as
 * `new X(...)` (kept for compatibility with pre-1.0 examples). Returns
 * a value with both call and construct signatures.
 *
 * Used by the auxiliary exports (`Sequencer`, `Reverb`, `CacheStorage`,
 * `Scheduler`, `SampleLoader`) to match the dual signature already shipped
 * by `InstrumentFactory`. Instrument factories themselves use the richer
 * `Instrument()` builder instead, which owns option-splitting and the
 * ready-promise lifecycle.
 */
export type Constructable<A extends unknown[], R> = {
  (...args: A): R;
  /** @deprecated Call as a function: `X(...)` instead of `new X(...)`. */
  new (...args: A): R;
};

export function asConstructable<A extends unknown[], R>(
  Klass: new (...args: A) => R,
): Constructable<A, R> {
  // Must be a regular function declaration (not an arrow): arrow functions
  // are not constructible, so `new asConstructable(X)()` would throw.
  // When invoked via `new`, the function returns an object, which the JS
  // spec uses in place of the freshly-allocated `this`.
  function factory(...args: A): R {
    return new Klass(...args);
  }
  return factory as unknown as Constructable<A, R>;
}
