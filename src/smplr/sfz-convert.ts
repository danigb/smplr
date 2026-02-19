import { toMidi } from "./midi";
import { SmplrGroup, SmplrJson, SmplrRegion } from "./types";

export type SfzConvertOptions = {
  /** Base URL prepended to all sample paths. */
  baseUrl: string;
  /**
   * Transform a raw SFZ sample path (e.g. "Arco\\C4.wav") to a SmplrJson
   * relative path WITHOUT the audio extension (e.g. "Arco/C4").
   * The SampleLoader will append ".<format>" when building the final URL.
   */
  pathFromSampleName: (name: string) => string;
  /** Audio formats in preference order. Defaults to ["ogg", "m4a"]. */
  formats?: string[];
};

/**
 * Parse SFZ text and convert to a SmplrJson descriptor.
 *
 * Handles both inline format (`<region> sample=foo.wav lokey=60`)
 * and multi-line format (headers on their own line, opcodes below).
 *
 * Fixes the "dropped final region" bug present in sfz2.ts by ensuring
 * the last scope is always closed.
 */
export function sfzToSmplrJson(
  sfzText: string,
  options: SfzConvertOptions
): SmplrJson {
  const formats = options.formats ?? ["ogg", "m4a"];

  // Parse all tokens from the SFZ text
  const tokens = tokenize(sfzText);

  // State machine
  type Mode = "global" | "group" | "region";
  let mode: Mode = "global";

  const globalProps: Record<string, string | number> = {};
  let groupProps: Record<string, string | number> = {};
  let regionProps: Record<string, string | number> = {};

  const groups: SmplrGroup[] = [];
  let currentGroup: SmplrGroup | null = null;

  function closeScope() {
    if (mode === "global") {
      Object.assign(globalProps, regionProps);
    } else if (mode === "group") {
      groupProps = { ...regionProps };
      // Build a new SmplrGroup from groupProps
      currentGroup = buildGroup(groupProps);
      groups.push(currentGroup);
    } else if (mode === "region") {
      // Merge: global → group → region
      const merged = { ...globalProps, ...groupProps, ...regionProps };
      const region = buildRegion(merged, options.pathFromSampleName);
      if (region) {
        // Ensure we have a current group
        if (!currentGroup) {
          currentGroup = { regions: [] };
          groups.push(currentGroup);
        }
        currentGroup.regions.push(region);
      }
    }
    regionProps = {};
  }

  for (const token of tokens) {
    if (token.type === "header") {
      closeScope();
      mode = token.value as Mode;
      if (mode === "group") {
        // New group scope
        groupProps = {};
        currentGroup = null;
      }
    } else {
      regionProps[token.key] = token.value;
    }
  }

  // Close the final scope
  closeScope();

  // Filter out empty groups
  const nonEmptyGroups = groups.filter((g) => g.regions.length > 0);

  return {
    samples: {
      baseUrl: options.baseUrl,
      formats,
    },
    groups: nonEmptyGroups,
  };
}

// ---------------------------------------------------------------------------
// Group / Region builders
// ---------------------------------------------------------------------------

function buildGroup(props: Record<string, string | number>): SmplrGroup {
  const group: SmplrGroup = { regions: [] };

  const lokey = num(props, "lokey");
  const hikey = num(props, "hikey");
  if (lokey !== undefined && hikey !== undefined) {
    group.keyRange = [lokey, hikey];
  }

  const lovel = num(props, "lovel");
  const hivel = num(props, "hivel");
  if (lovel !== undefined && hivel !== undefined) {
    group.velRange = [lovel, hivel];
  }

  const seqLength = num(props, "seq_length");
  if (seqLength !== undefined) group.seqLength = seqLength;

  const groupNum = num(props, "group");
  if (groupNum !== undefined) group.group = groupNum;

  const offBy = num(props, "off_by");
  if (offBy !== undefined) group.offBy = offBy;

  const volume = num(props, "volume");
  if (volume !== undefined) group.volume = volume;

  const ampRelease = num(props, "ampeg_release");
  if (ampRelease !== undefined) group.ampRelease = ampRelease;

  const tune = num(props, "tune");
  if (tune !== undefined) group.tune = tune / 100; // SFZ tune is in cents, convert to semitones

  return group;
}

function buildRegion(
  props: Record<string, string | number>,
  pathFromSampleName: (name: string) => string
): SmplrRegion | null {
  const sampleRaw = str(props, "sample");
  if (!sampleRaw) return null;

  const sample = pathFromSampleName(sampleRaw);
  const region: SmplrRegion = { sample };

  // Key range
  const key = num(props, "key");
  if (key !== undefined) {
    region.key = key;
  } else {
    const lokey = num(props, "lokey");
    const hikey = num(props, "hikey");
    if (lokey !== undefined && hikey !== undefined) {
      region.keyRange = [lokey, hikey];
    }
  }

  // Pitch
  const pitchKeycenter = num(props, "pitch_keycenter");
  if (pitchKeycenter !== undefined) {
    region.pitch = pitchKeycenter;
  } else if (region.keyRange) {
    // Fall back to lokey as pitch if pitch_keycenter absent
    region.pitch = region.keyRange[0];
  } else if (key !== undefined) {
    region.pitch = key;
  }

  // Velocity range
  const lovel = num(props, "lovel");
  const hivel = num(props, "hivel");
  if (lovel !== undefined && hivel !== undefined) {
    region.velRange = [lovel, hivel];
  }

  // Round-robin
  const seqPosition = num(props, "seq_position");
  if (seqPosition !== undefined) region.seqPosition = seqPosition;

  // Exclusive groups
  const groupNum = num(props, "group");
  if (groupNum !== undefined) region.group = groupNum;

  const offBy = num(props, "off_by");
  if (offBy !== undefined) region.offBy = offBy;

  // Volume (dB)
  const volume = num(props, "volume");
  if (volume !== undefined) region.volume = volume;

  // Tune (SFZ cents → semitones)
  const tune = num(props, "tune");
  if (tune !== undefined) region.tune = tune / 100;

  // Amplitude release
  const ampRelease = num(props, "ampeg_release");
  if (ampRelease !== undefined) region.ampRelease = ampRelease;

  // Velocity curve
  const ampVelcurve = numArr(props, "amp_velcurve");
  if (ampVelcurve) region.ampVelCurve = ampVelcurve;

  return region;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type HeaderToken = { type: "header"; value: string };
type PropToken = { type: "prop"; key: string; value: string | number };
type Token = HeaderToken | PropToken;

/**
 * Tokenize SFZ text into a flat list of header or prop tokens.
 *
 * Handles:
 * - `// line comments`
 * - `<header>` — may appear inline or on own line
 * - `key=value` pairs — multiple per line, value may be a path (no spaces)
 */
function tokenize(sfz: string): Token[] {
  const tokens: Token[] = [];

  for (let line of sfz.split("\n")) {
    // Strip line comments
    const commentIdx = line.indexOf("//");
    if (commentIdx >= 0) line = line.slice(0, commentIdx);
    line = line.trim();
    if (!line) continue;

    // Process the line chunk by chunk
    let pos = 0;
    while (pos < line.length) {
      // Skip leading whitespace
      while (pos < line.length && line[pos] === " ") pos++;
      if (pos >= line.length) break;

      // Header: <something>
      if (line[pos] === "<") {
        const end = line.indexOf(">", pos);
        if (end < 0) break;
        const headerName = line.slice(pos + 1, end).trim().toLowerCase();
        tokens.push({ type: "header", value: headerName });
        pos = end + 1;
        continue;
      }

      // Key=value: find the next = sign
      const eqIdx = line.indexOf("=", pos);
      if (eqIdx < 0) break;

      const key = line.slice(pos, eqIdx).trim();

      // Value: read until next whitespace (for simple values) or next key=
      // We read until whitespace, but if the next token also looks like key=,
      // we stop there.
      let valueEnd = eqIdx + 1;
      // Find the end of the value: either end of line or the start of the next key=
      // Strategy: find next whitespace-preceded word that contains '='
      const rest = line.slice(eqIdx + 1);
      const nextKeyMatch = rest.match(/\s+\S+=\S/);
      let rawValue: string;
      if (nextKeyMatch && nextKeyMatch.index !== undefined) {
        rawValue = rest.slice(0, nextKeyMatch.index).trim();
        valueEnd = eqIdx + 1 + nextKeyMatch.index + nextKeyMatch[0].length - nextKeyMatch[0].trimStart().length;
      } else {
        rawValue = rest.trim();
        valueEnd = line.length;
      }

      if (key && rawValue !== undefined) {
        const numVal = Number(rawValue);
        tokens.push({
          type: "prop",
          key,
          value: isNaN(numVal) ? rawValue : numVal,
        });
      }

      pos = valueEnd;
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(
  props: Record<string, string | number>,
  key: string
): number | undefined {
  const v = props[key];
  if (typeof v === "number") return v;
  return undefined;
}

function str(
  props: Record<string, string | number>,
  key: string
): string | undefined {
  const v = props[key];
  if (typeof v === "string") return v;
  return undefined;
}

function numArr(
  props: Record<string, string | number>,
  _prefix: string
): [number, number] | undefined {
  // SFZ amp_velcurve_N=V format: key is amp_velcurve_<velocity>
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith("amp_velcurve_")) {
      const vel = Number(k.slice("amp_velcurve_".length));
      if (!isNaN(vel) && typeof v === "number") {
        return [vel, v];
      }
    }
  }
  return undefined;
}
