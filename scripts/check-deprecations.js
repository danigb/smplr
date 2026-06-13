#!/usr/bin/env node
/**
 * Deprecation linter.
 *
 * Surfaces every use of an API marked `@deprecated` — the same "deprecated"
 * squiggles VS Code shows in the editor. These are TypeScript *suggestion*
 * diagnostics; `tsc --noEmit` does NOT report them, so they're invisible on the
 * CLI without this script. Mirrors the language-server diagnostics by reusing
 * the project's tsconfig.
 *
 * Files under `__compat__/` are allowed to use deprecated aliases — that's
 * exactly what those tripwire tests exist to verify — so they're listed but
 * don't fail the run. Exit code is non-zero only when a non-allowed usage
 * remains, making this usable as a CI gate.
 */
const path = require("path");
const ts = require("typescript");

const root = process.cwd();

const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
if (!configPath) {
  console.error("check-deprecations: could not find tsconfig.json");
  process.exit(2);
}

const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
if (error) {
  console.error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
  process.exit(2);
}
const parsed = ts.parseJsonConfigFileContent(
  config,
  ts.sys,
  path.dirname(configPath),
);

const fileNames = parsed.fileNames;
const host = {
  getScriptFileNames: () => fileNames,
  getScriptVersion: () => "1",
  getScriptSnapshot: (f) =>
    ts.sys.fileExists(f)
      ? ts.ScriptSnapshot.fromString(ts.sys.readFile(f))
      : undefined,
  getCurrentDirectory: () => root,
  getCompilationSettings: () => parsed.options,
  getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
};
const service = ts.createLanguageService(host, ts.createDocumentRegistry());

// Directories whose whole purpose is to exercise deprecated aliases.
const ALLOWED = [`${path.sep}__compat__${path.sep}`];

const toFix = [];
const allowed = [];
for (const file of fileNames) {
  for (const d of service.getSuggestionDiagnostics(file)) {
    if (!d.reportsDeprecated || d.start === undefined) continue;
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);

    // Per-line opt-out for intentional deprecated-alias implementations.
    const starts = d.file.getLineStarts();
    const lineText = d.file.text.slice(
      starts[line],
      starts[line + 1] ?? d.file.text.length,
    );
    if (lineText.includes("// deprecation-ok")) continue;

    const rel = path.relative(root, d.file.fileName);
    const msg = ts.flattenDiagnosticMessageText(d.messageText, " ");
    const entry = `${rel}:${line + 1}:${character + 1}  ${msg}`;
    if (ALLOWED.some((a) => d.file.fileName.includes(a))) allowed.push(entry);
    else toFix.push(entry);
  }
}

const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");

if (toFix.length === 0 && allowed.length === 0) {
  console.log("✓ No @deprecated API usages found.");
  process.exit(0);
}

// The to-fix list is actionable, so always show it.
if (toFix.length) {
  console.log(`Deprecated API usages (${toFix.length}):\n`);
  console.log(toFix.sort().join("\n"));
  console.log("");
}

// The allowed __compat__ entries are expected and just noise on a green run;
// dump them only on demand (`npm run lint -- --verbose`).
if (allowed.length && verbose) {
  console.log(`Allowed in __compat__ (${allowed.length}):\n`);
  console.log(allowed.sort().join("\n"));
  console.log("");
}

if (toFix.length === 0) {
  const hint = verbose ? "" : " (run with --verbose to list them)";
  console.log(`✓ 0 to fix, ${allowed.length} allowed in __compat__${hint}.`);
} else {
  console.log(`${toFix.length} to fix, ${allowed.length} allowed.`);
}
process.exit(toFix.length > 0 ? 1 : 0);
