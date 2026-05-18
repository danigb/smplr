/**
 * Public-surface tripwire — asserts the shape of the emitted `dist/index.d.ts`
 * that ships to npm. Complements:
 *
 *   - `construct-signature.test.ts` (runtime `new X(...)` / `X(...)`)
 *   - `load-getter.test.ts` (runtime `.load` resolves-to-instance)
 *   - `output-aliases.test.ts` (runtime `setVolume`/`sendEffect` callable)
 *
 * Those three defend *runtime* behavior. This file defends the *structural
 * shape* of the type definitions: a future refactor cannot re-leak `Smplr`
 * as a class, drop `Instrument`, or hide a documented factory without
 * lighting up here first.
 *
 * Skips when `dist/index.d.ts` is missing (so `npm run test:unit` without
 * `npm run build` still works for the 90% of edits that don't touch the
 * public surface). CI runs `npm run build && npm test`, so this test is
 * unconditional on release branches.
 *
 * The regex matchers assume the emitted `.d.ts` ends in a single large
 * `export { ... }` block — true of the current `tsup`/`tsc` toolchain.
 * If the build pipeline changes, swap to an AST-based check using the
 * `typescript` `createSourceFile` API; the assertions stay identical.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIST_DTS = join(__dirname, "..", "..", "dist", "index.d.ts");
const haveDist = existsSync(DIST_DTS);
const describeIfBuilt = haveDist ? describe : describe.skip;

describeIfBuilt("public surface (dist/index.d.ts)", () => {
  const dts = haveDist ? readFileSync(DIST_DTS, "utf8") : "";

  /**
   * The final `export { … }` block — the canonical list of what ships to npm.
   * Internal `declare class …`, supporting `interface PluginSmplr`, and
   * JSDoc text don't matter for the public-contract assertions; only the
   * symbols listed inside this block are reachable to `import { … } from "smplr"`.
   */
  const exportBlock: string = (() => {
    const matches = [...dts.matchAll(/export\s*\{([^}]+)\}/g)];
    // Pick the last one (the consolidated emit at the bottom of the file).
    return matches.length ? (matches[matches.length - 1][1] ?? "") : "";
  })();

  /** Parse the comma-separated entries into `{ name, isType }` records. */
  type Entry = { name: string; isType: boolean };
  const entries: Entry[] = exportBlock
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean)
    .map((entry: string): Entry | null => {
      const m = entry.match(/^(type\s+)?([A-Za-z_][A-Za-z0-9_]*)$/);
      return m ? { name: m[2], isType: !!m[1] } : null;
    })
    .filter((x: Entry | null): x is Entry => x !== null);

  const valueExports = new Set(
    entries.filter((e: Entry) => !e.isType).map((e: Entry) => e.name),
  );
  const typeExports = new Set(
    entries.filter((e: Entry) => e.isType).map((e: Entry) => e.name),
  );

  it("exports `Smplr` only as a type (never as a value)", () => {
    expect(typeExports.has("Smplr")).toBe(true);
    expect(valueExports.has("Smplr")).toBe(false);
    // And no `declare class Smplr` anywhere in the file.
    expect(dts).not.toMatch(/^declare class Smplr\b/m);
  });

  it("exports `Instrument` as a value (not a type)", () => {
    expect(valueExports.has("Instrument")).toBe(true);
    expect(typeExports.has("Instrument")).toBe(false);
  });

  it("exports `SmplrPlugin` as a type", () => {
    expect(typeExports.has("SmplrPlugin")).toBe(true);
    expect(valueExports.has("SmplrPlugin")).toBe(false);
  });

  it("exports `SmplrOptions` as a type (unchanged from pre-1.0)", () => {
    expect(typeExports.has("SmplrOptions")).toBe(true);
  });

  it("does not leak `PluginSmplr` (CD-4 invariant: plugin-only type stays internal)", () => {
    expect(valueExports.has("PluginSmplr")).toBe(false);
    expect(typeExports.has("PluginSmplr")).toBe(false);
  });

  it("does not leak `SmplrImpl` (internal class stays internal)", () => {
    expect(valueExports.has("SmplrImpl")).toBe(false);
    expect(typeExports.has("SmplrImpl")).toBe(false);
  });

  it("exports all 5 auxiliary factories as values", () => {
    for (const name of [
      "Reverb",
      "Sequencer",
      "CacheStorage",
      "Scheduler",
      "SampleLoader",
    ]) {
      expect(valueExports.has(name)).toBe(true);
    }
  });

  it("declares a same-named instance type alongside each auxiliary factory", () => {
    // Dual export pattern, same as the instrument factories above:
    // `const X` (factory) + `type X = ReturnType<typeof X>`. Lets users write
    // `useState<Sequencer | undefined>()` without `ReturnType<typeof Sequencer>`.
    //
    // `Scheduler` and `SampleLoader` use a narrowed-interface form instead
    // (locked down in `loader-scheduler-surface.test.ts`).
    for (const name of ["Reverb", "Sequencer", "CacheStorage"]) {
      expect(dts).toMatch(
        new RegExp(`^type ${name}\\s*=\\s*ReturnType<typeof ${name}>`, "m"),
      );
      expect(valueExports.has(name)).toBe(true);
    }
  });

  it("exports all 11 first-party factories as values (with Soundfont2Sampler as deprecated alias)", () => {
    for (const name of [
      "Sampler",
      "Soundfont",
      "SplendidGrandPiano",
      "DrumMachine",
      "DrumAbuse",
      "ElectricPiano",
      "Mallet",
      "Mellotron",
      "Smolken",
      "Versilian",
      "Soundfont2",
      "Soundfont2Sampler",
    ]) {
      expect(valueExports.has(name)).toBe(true);
    }
  });

  it("declares a same-named instance type alongside each factory", () => {
    // Dual export: `const X` (factory) + `type X = ReturnType<typeof X>`. Lets
    // users write `useState<Sampler | undefined>()` without reaching for
    // `ReturnType<typeof Sampler>`. TS collapses dual value+type exports into
    // one entry in the export block, so we assert on the declaration directly.
    // `Soundfont2Sampler` is excluded — it's a deprecated alias of `Soundfont2`
    // (`type Soundfont2Sampler = Soundfont2`), not its own `ReturnType<typeof ...>`.
    for (const name of [
      "Sampler",
      "Soundfont",
      "SplendidGrandPiano",
      "DrumMachine",
      "DrumAbuse",
      "ElectricPiano",
      "Mallet",
      "Mellotron",
      "Smolken",
      "Versilian",
      "Soundfont2",
    ]) {
      expect(dts).toMatch(
        new RegExp(`^type ${name}\\s*=\\s*ReturnType<typeof ${name}>`, "m"),
      );
      // Factory must still be a value export (already covered by the previous
      // test, but re-asserted here so the failure message is self-contained).
      expect(valueExports.has(name)).toBe(true);
    }
  });

  it("does not export internal spread utilities", () => {
    expect(valueExports.has("spreadKeyRanges")).toBe(false);
    expect(typeExports.has("SpreadResult")).toBe(false);
  });

  it("does not export internal SFZ conversion", () => {
    expect(valueExports.has("sfzToPreset")).toBe(false);
  });

  it("does not export internal MIDI helpers", () => {
    expect(valueExports.has("toMidi")).toBe(false);
    expect(valueExports.has("findNearestMidi")).toBe(false);
  });

  it("exports the SmplrPreset type with optional smplr version field", () => {
    expect(typeExports.has("SmplrPreset")).toBe(true);
    expect(dts).toMatch(/smplr\?\s*:\s*["']1\.0["']/);
  });

  // Keeps `TransportClock` and friends internal so future shared-transport work
  // (research: thoughts/research/2026-05-17_20-18-43_shared-transport.md) can
  // land additively in 1.x — names, shapes, and `seekAt` semantics stay free to
  // change while the type isn't part of the npm contract.
  it("does not export TransportClock or its companions", () => {
    expect(valueExports.has("TransportClock")).toBe(false);
    expect(typeExports.has("TransportClock")).toBe(false);
    expect(valueExports.has("TransportState")).toBe(false);
    expect(typeExports.has("TransportState")).toBe(false);
    expect(valueExports.has("TransportClockOptions")).toBe(false);
    expect(typeExports.has("TransportClockOptions")).toBe(false);
  });
});
