import { toMidi } from "./midi";
import { SmplrGroup, SmplrPreset, SmplrRegion } from "./types";

/**
 * Limit which samples an instrument loads to the ones needed to play the
 * given notes and velocities.
 */
export type NotesToLoad = {
  /**
   * Notes that will be played: MIDI numbers, note names or preset aliases
   * (e.g. `"kick"` on a drum machine). Every region that covers one of them
   * is loaded. Omit to load all notes; `[]` loads none.
   */
  notes?: Array<string | number>;
  /** Only load regions whose velocity range overlaps `[low, high]`. */
  velocityRange?: [number, number];
  /**
   * What to play for a note that wasn't loaded:
   * - `"none"` (default): nothing.
   * - `"nearest"`: the nearest loaded note, pitch-shifted to the played one.
   *   Ties resolve to the lower note.
   */
  fallback?: "none" | "nearest";
};

export type FilteredPreset = {
  /** The preset with only the groups and regions that need loading. */
  preset: SmplrPreset;
  /** Whether anything was filtered (`notes` or `velocityRange` given). */
  filtered: boolean;
  /** `notes` entries that are neither a MIDI number, a note name nor an alias. */
  unresolved: Array<string | number>;
};

/**
 * Remove the groups and regions of `preset` that are not needed to play the
 * notes and velocities in `notesToLoad`. Returns the preset unchanged when
 * `notesToLoad` has neither `notes` nor `velocityRange`.
 */
export function filterPreset(
  preset: SmplrPreset,
  notesToLoad: NotesToLoad | undefined,
): FilteredPreset {
  if (!notesToLoad || (!notesToLoad.notes && !notesToLoad.velocityRange)) {
    return { preset, filtered: false, unresolved: [] };
  }

  const { notes: midis, unresolved } = resolveNotes(
    notesToLoad.notes,
    preset.aliases,
  );
  const velocityRange = notesToLoad.velocityRange;

  const groups: SmplrGroup[] = [];
  for (const group of preset.groups) {
    const [groupKeyLow, groupKeyHigh] = group.keyRange ?? [0, 127];
    const regions = group.regions.filter((region) => {
      if (
        velocityRange &&
        !(
          overlaps(velocityRange, group.velRange) &&
          overlaps(velocityRange, region.velRange)
        )
      ) {
        return false;
      }
      if (!midis) return true;
      const [regionKeyLow, regionKeyHigh] = regionKeyRange(region);
      const keyLow = Math.max(groupKeyLow, regionKeyLow);
      const keyHigh = Math.min(groupKeyHigh, regionKeyHigh);
      return midis.some((midi) => midi >= keyLow && midi <= keyHigh);
    });

    if (regions.length > 0) groups.push({ ...group, regions });
  }

  return { preset: { ...preset, groups }, filtered: true, unresolved };
}

/**
 * Nearest key to `midi` (0–127) for which `isPlayable` returns true,
 * preferring the lower one on ties. Returns `undefined` when there is none.
 */
export function findNearestKey(
  midi: number,
  isPlayable: (key: number) => boolean,
): number | undefined {
  for (let distance = 1; distance < 128; distance++) {
    const lower = midi - distance;
    const upper = midi + distance;
    if (lower >= 0 && lower <= 127 && isPlayable(lower)) return lower;
    if (upper >= 0 && upper <= 127 && isPlayable(upper)) return upper;
  }
  return undefined;
}

function resolveNotes(
  notes: Array<string | number> | undefined,
  aliases: Record<string, number> | undefined,
): { notes: number[] | undefined; unresolved: Array<string | number> } {
  if (!notes) return { notes: undefined, unresolved: [] };
  const resolved: number[] = [];
  const unresolved: Array<string | number> = [];
  for (const note of notes) {
    // Same resolution order as Smplr.start(): note name / number, then alias
    const midi = toMidi(note) ?? aliases?.[String(note)];
    if (
      midi !== undefined &&
      Number.isInteger(midi) &&
      midi >= 0 &&
      midi <= 127
    ) {
      resolved.push(midi);
    } else {
      unresolved.push(note);
    }
  }
  return { notes: resolved, unresolved };
}

function regionKeyRange(region: SmplrRegion): [number, number] {
  if (region.key !== undefined) return [region.key, region.key];
  return region.keyRange ?? [0, 127];
}

function overlaps(
  [low, high]: [number, number],
  range: [number, number] | undefined,
): boolean {
  if (!range) return true;
  return low <= range[1] && high >= range[0];
}
