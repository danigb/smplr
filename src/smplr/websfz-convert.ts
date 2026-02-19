import { Websfz, WebsfzGroup, WebsfzRegion } from "../sfz/websfz";
import { SmplrGroup, SmplrJson, SmplrRegion } from "./types";

/**
 * Convert a WebSFZ JSON descriptor to a SmplrJson descriptor.
 *
 * Mappings:
 * - `meta.baseUrl` → `samples.baseUrl`
 * - `meta.formats` → `samples.formats`
 * - `WebsfzGroup` → `SmplrGroup`
 * - `WebsfzRegion` → `SmplrRegion`
 * - `locc64/hicc64` → `ccRange: { "64": [lo, hi] }`
 */
export function websfzToSmplrJson(websfz: Websfz): SmplrJson {
  const prefix = String(websfz.global["default_path"] ?? "");

  const groups: SmplrGroup[] = websfz.groups.map((wg) =>
    convertGroup(wg, prefix)
  );

  return {
    meta: {
      name: websfz.meta.name,
      description: websfz.meta.description,
      license: websfz.meta.license,
      source: websfz.meta.source,
      tags: websfz.meta.tags,
    },
    samples: {
      baseUrl: websfz.meta.baseUrl ?? "",
      formats: websfz.meta.formats ?? ["ogg"],
    },
    groups,
  };
}

// ---------------------------------------------------------------------------
// Group conversion
// ---------------------------------------------------------------------------

function convertGroup(wg: WebsfzGroup, prefix: string): SmplrGroup {
  const group: SmplrGroup = {
    regions: wg.regions.map((wr) => convertRegion(wr, prefix)),
  };

  if (wg.lokey !== undefined && wg.hikey !== undefined) {
    group.keyRange = [wg.lokey, wg.hikey];
  }
  if (wg.lovel !== undefined && wg.hivel !== undefined) {
    group.velRange = [wg.lovel, wg.hivel];
  }

  // CC64 (sustain pedal) range
  const ccRange = buildCcRange(wg);
  if (ccRange) group.ccRange = ccRange;

  if (wg.off_by !== undefined) group.offBy = wg.off_by;
  if (wg.group !== undefined) group.group = wg.group;
  if (wg.seq_length !== undefined) group.seqLength = wg.seq_length;
  if (wg.trigger !== undefined) group.trigger = wg.trigger;
  if (wg.volume !== undefined) group.volume = wg.volume;

  return group;
}

// ---------------------------------------------------------------------------
// Region conversion
// ---------------------------------------------------------------------------

function convertRegion(wr: WebsfzRegion, prefix: string): SmplrRegion {
  const region: SmplrRegion = {
    sample: prefix + wr.sample,
  };

  // Key / keyRange
  if (wr.key !== undefined) {
    region.key = wr.key;
  } else if (wr.lokey !== undefined && wr.hikey !== undefined) {
    region.keyRange = [wr.lokey, wr.hikey];
  }

  // Pitch
  if (wr.pitch_keycenter !== undefined) {
    region.pitch = wr.pitch_keycenter;
  }

  // Velocity range
  if (wr.lovel !== undefined && wr.hivel !== undefined) {
    region.velRange = [wr.lovel, wr.hivel];
  }

  // CC range
  const ccRange = buildCcRange(wr);
  if (ccRange) region.ccRange = ccRange;

  // Round-robin
  if (wr.seq_position !== undefined) region.seqPosition = wr.seq_position;

  // Exclusive groups
  if (wr.off_by !== undefined) region.offBy = wr.off_by;
  if (wr.group !== undefined) region.group = wr.group;

  // Trigger
  if (wr.trigger !== undefined) region.trigger = wr.trigger;

  // Volume
  if (wr.volume !== undefined) region.volume = wr.volume;

  return region;
}

// ---------------------------------------------------------------------------
// CC range helpers
// ---------------------------------------------------------------------------

/**
 * Build ccRange from locc64/hicc64 fields.
 * Returns undefined if neither field is present.
 */
function buildCcRange(
  obj: WebsfzGroup | WebsfzRegion
): Record<string, [number, number]> | undefined {
  const result: Record<string, [number, number]> = {};

  if (obj.locc64 !== undefined && obj.hicc64 !== undefined) {
    result["64"] = [obj.locc64, obj.hicc64];
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
