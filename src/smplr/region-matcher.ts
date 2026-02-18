import { SmplrGroup, SmplrJson, SmplrRegion } from "./types";

/**
 * A region that matched a note event. Carries resolved identity fields and references
 * to the original group/region objects so Smplr can call resolveParams().
 */
export type MatchedRegion = {
  sample: string; // buffer key
  pitch: number; // root MIDI pitch of the sample (used for detune calculation)
  group?: number; // exclusive group number (for VoiceManager)
  offBy?: number; // stop voices in this group before playing
  groupRef: SmplrGroup; // original group, passed to resolveParams()
  regionRef: SmplrRegion; // original region, passed to resolveParams()
};

// ---------------------------------------------------------------------------
// Pre-processed internal types — built once in the constructor
// ---------------------------------------------------------------------------

type ProcessedRegion = {
  keyLow: number;
  keyHigh: number;
  pitch: number | undefined; // undefined → use played MIDI note as pitch
  velLow: number;
  velHigh: number;
  ccRange?: Record<string, [number, number]>;
  seqPosition: number; // 1-based
  group?: number;
  offBy?: number;
  sample: string;
  ref: SmplrRegion;
};

type ProcessedGroup = {
  keyLow: number;
  keyHigh: number;
  velLow: number;
  velHigh: number;
  ccRange?: Record<string, [number, number]>;
  seqLength?: number;
  group?: number;
  offBy?: number;
  regions: ProcessedRegion[];
  ref: SmplrGroup;
};

// ---------------------------------------------------------------------------
// Pre-processing helpers
// ---------------------------------------------------------------------------

function processRegion(region: SmplrRegion): ProcessedRegion {
  let keyLow: number;
  let keyHigh: number;
  let pitch: number | undefined;

  if (region.key !== undefined) {
    // Shorthand: key sets both the trigger range and the root pitch
    keyLow = keyHigh = region.key;
    pitch = region.key;
  } else if (region.keyRange) {
    [keyLow, keyHigh] = region.keyRange;
    pitch = region.pitch; // may be undefined — resolved at match time
  } else {
    // No key constraint — region matches all MIDI notes
    keyLow = 0;
    keyHigh = 127;
    pitch = region.pitch;
  }

  return {
    keyLow,
    keyHigh,
    pitch,
    velLow: region.velRange?.[0] ?? 0,
    velHigh: region.velRange?.[1] ?? 127,
    ccRange: region.ccRange,
    seqPosition: region.seqPosition ?? 1,
    group: region.group,
    offBy: region.offBy,
    sample: region.sample,
    ref: region,
  };
}

function processGroup(group: SmplrGroup): ProcessedGroup {
  return {
    keyLow: group.keyRange?.[0] ?? 0,
    keyHigh: group.keyRange?.[1] ?? 127,
    velLow: group.velRange?.[0] ?? 0,
    velHigh: group.velRange?.[1] ?? 127,
    ccRange: group.ccRange,
    seqLength: group.seqLength,
    group: group.group,
    offBy: group.offBy,
    regions: group.regions.map(processRegion),
    ref: group,
  };
}

// ---------------------------------------------------------------------------
// CC matching helper
// ---------------------------------------------------------------------------

function matchesCc(
  ccState: Map<number, number>,
  ccRange?: Record<string, [number, number]>
): boolean {
  if (!ccRange) return true;
  for (const [ccStr, [low, high]] of Object.entries(ccRange)) {
    const cc = parseInt(ccStr, 10);
    const value = ccState.get(cc) ?? 0; // default: 0 (pedal up, etc.)
    if (value < low || value > high) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// RegionMatcher
// ---------------------------------------------------------------------------

export class RegionMatcher {
  #groups: ProcessedGroup[];
  #seqCounters: Map<number, number>; // groupIndex → call count

  constructor(json: SmplrJson) {
    this.#groups = json.groups.map(processGroup);
    this.#seqCounters = new Map();
  }

  /**
   * Match a note event against all groups and regions.
   *
   * For each group that passes key/vel/cc filters:
   *   - Check each region's key/vel/cc filters
   *   - Apply round-robin seqPosition filter if group.seqLength is set
   *   - Advance the per-group round-robin counter (always, when group matched)
   *
   * Returns all matched regions with resolved pitch, group, offBy.
   */
  match(
    midi: number,
    velocity: number,
    ccState: Map<number, number>
  ): MatchedRegion[] {
    const results: MatchedRegion[] = [];

    for (let gi = 0; gi < this.#groups.length; gi++) {
      const group = this.#groups[gi];

      // Group-level filters
      if (midi < group.keyLow || midi > group.keyHigh) continue;
      if (velocity < group.velLow || velocity > group.velHigh) continue;
      if (!matchesCc(ccState, group.ccRange)) continue;

      const counter = this.#seqCounters.get(gi) ?? 0;

      for (const region of group.regions) {
        // Region-level filters
        if (midi < region.keyLow || midi > region.keyHigh) continue;
        if (velocity < region.velLow || velocity > region.velHigh) continue;
        if (!matchesCc(ccState, region.ccRange)) continue;

        // Round-robin filter: only allow the region whose seqPosition matches
        // the current counter for this group
        if (group.seqLength !== undefined) {
          const seqPos = region.seqPosition - 1; // to 0-based
          if (counter % group.seqLength !== seqPos) continue;
        }

        results.push({
          sample: region.sample,
          // If no pitch is pre-resolved (no key or pitch on region), fall back to
          // the played note so resolveParams computes 0 semitones of transpose
          pitch: region.pitch ?? midi,
          group: region.group ?? group.group,
          offBy: region.offBy ?? group.offBy,
          groupRef: group.ref,
          regionRef: region.ref,
        });
      }

      // Advance per-group round-robin counter whenever the group matched,
      // regardless of whether a region's seqPosition filter passed.
      if (group.seqLength !== undefined) {
        this.#seqCounters.set(gi, counter + 1);
      }
    }

    return results;
  }
}
