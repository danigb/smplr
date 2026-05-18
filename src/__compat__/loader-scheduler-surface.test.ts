/**
 * Loader/Scheduler public-surface tripwire — locks the narrowed 1.0 contract
 * for `Scheduler` and `SampleLoader`. Sibling of `public-surface.test.ts`,
 * scoped to the two interfaces that were the gating item for the 1.0 stability
 * commitment (see CHANGELOG L270 and MIGRATE.md).
 *
 * Asserts the shape of the emitted `dist/index.d.ts`:
 *   1. Both names are exported as both value (the factory) and type (the interface).
 *   2. The interface bodies contain only the documented methods.
 *   3. Impl class names (`SchedulerImpl`, `SampleLoaderImpl`) do not appear.
 *   4. The constructor / load option types are exported.
 *
 * Skips when `dist/index.d.ts` is missing (so `npm run test:unit` works
 * without a prior build). CI runs `npm run build && npm test`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIST_DTS = join(__dirname, "..", "..", "dist", "index.d.ts");
const haveDist = existsSync(DIST_DTS);
const describeIfBuilt = haveDist ? describe : describe.skip;

/**
 * Extract the body of `interface Name { ... }` from the .d.ts source.
 * Returns the raw text between the opening `{` and the matching closing `}`,
 * scanning line-by-line so JSDoc `{@link X}` references inside the body don't
 * confuse a regex-based extraction.
 */
function extractInterfaceBody(dts: string, name: string): string | null {
  const lines = dts.split("\n");
  const startRegex = new RegExp(`^interface ${name}\\s*\\{\\s*$`);
  const startIdx = lines.findIndex((l) => startRegex.test(l));
  if (startIdx === -1) return null;

  // Scan forward for a line that is exactly `}` (the interface's close brace,
  // emitted at column 0 by the bundler).
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i] === "}") {
      return lines.slice(startIdx + 1, i).join("\n");
    }
  }
  return null;
}

/**
 * Extract method names from an interface body. A method declaration looks like
 * `    schedule(event: NoteEvent, ...): StopFn;` — four-space indent + name
 * + open paren. Returns unique names in declaration order.
 */
function extractMethodNames(body: string): string[] {
  const names = new Set<string>();
  for (const line of body.split("\n")) {
    const m = line.match(/^    (\w+)\s*\(/);
    if (m) names.add(m[1]);
  }
  return [...names];
}

/** Find the final `export { … }` block — the canonical list of public exports. */
function extractExportBlock(dts: string): string {
  const matches = [...dts.matchAll(/export\s*\{([^}]+)\}/g)];
  return matches.length ? (matches[matches.length - 1][1] ?? "") : "";
}

describeIfBuilt("loader/scheduler public surface (dist/index.d.ts)", () => {
  const dts = haveDist ? readFileSync(DIST_DTS, "utf8") : "";
  const exportBlock = haveDist ? extractExportBlock(dts) : "";

  describe("Scheduler", () => {
    it("is declared as an interface", () => {
      expect(dts).toMatch(/^interface Scheduler\s*\{/m);
    });

    it("is declared as a const value (the factory)", () => {
      expect(dts).toMatch(/^declare const Scheduler:\s*SchedulerFactory;/m);
    });

    it("appears in the final export block (value form)", () => {
      // Value-form exports list the name without a `type` prefix.
      expect(exportBlock).toMatch(/(^|,\s*)Scheduler(\s*,|\s*$)/);
    });

    it("does not leak `SchedulerImpl`", () => {
      expect(dts).not.toMatch(/\bSchedulerImpl\b/);
    });

    it("interface declares only `schedule` and `stop`", () => {
      const body = extractInterfaceBody(dts, "Scheduler");
      expect(body).not.toBeNull();
      const methods = extractMethodNames(body!).sort();
      expect(methods).toEqual(["schedule", "stop"]);
    });
  });

  describe("SchedulerOptions", () => {
    it("is exported as a type", () => {
      expect(dts).toMatch(/^type SchedulerOptions\s*=\s*\{/m);
      expect(exportBlock).toMatch(/type SchedulerOptions\b/);
    });
  });

  describe("SampleLoader", () => {
    it("is declared as an interface", () => {
      expect(dts).toMatch(/^interface SampleLoader\s*\{/m);
    });

    it("is declared as a const value (the factory)", () => {
      expect(dts).toMatch(
        /^declare const SampleLoader:\s*SampleLoaderFactory;/m,
      );
    });

    it("appears in the final export block (value form)", () => {
      expect(exportBlock).toMatch(/(^|,\s*)SampleLoader(\s*,|\s*$)/);
    });

    it("does not leak `SampleLoaderImpl`", () => {
      expect(dts).not.toMatch(/\bSampleLoaderImpl\b/);
    });

    it("interface declares only `load`", () => {
      const body = extractInterfaceBody(dts, "SampleLoader");
      expect(body).not.toBeNull();
      const methods = extractMethodNames(body!);
      expect(methods).toEqual(["load"]);
    });

    it("`load` has exactly two overloads (canonical + deprecated callback)", () => {
      const body = extractInterfaceBody(dts, "SampleLoader");
      expect(body).not.toBeNull();
      const overloads = [...body!.matchAll(/^    load\s*\(/gm)];
      expect(overloads.length).toBe(2);
    });
  });

  describe("SampleLoaderOptions / SampleLoaderLoadOptions", () => {
    it("`SampleLoaderOptions` is exported as a type", () => {
      expect(dts).toMatch(/^type SampleLoaderOptions\s*=\s*\{/m);
      expect(exportBlock).toMatch(/type SampleLoaderOptions\b/);
    });

    it("`SampleLoaderLoadOptions` is exported as a type", () => {
      expect(dts).toMatch(/^type SampleLoaderLoadOptions\s*=\s*\{/m);
      expect(exportBlock).toMatch(/type SampleLoaderLoadOptions\b/);
    });
  });
});
