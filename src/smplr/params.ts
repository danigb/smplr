import { PlaybackParams, SmplrGroup, SmplrRegion, VoiceParams } from "./types";

/**
 * Hardcoded defaults — the baseline when nothing else is specified.
 */
export const PARAM_DEFAULTS: Required<PlaybackParams> = {
  volume: 0,
  tune: 0,
  detune: 0,
  ampRelease: 0.3,
  ampAttack: 0,
  lpfCutoffHz: 20000,
  offset: 0,
  loop: false,
  loopStart: 0,
  loopEnd: 0,
};

const PLAYBACK_KEYS = Object.keys(PARAM_DEFAULTS) as (keyof PlaybackParams)[];

/**
 * Extract only PlaybackParams fields from a group or region object,
 * ignoring structural fields like keyRange, velRange, regions, etc.
 */
function pickPlaybackParams(obj: PlaybackParams): PlaybackParams {
  const result: PlaybackParams = {};
  for (const key of PLAYBACK_KEYS) {
    const value = obj[key];
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

/**
 * Per-note overrides that can be passed via NoteEvent at play time.
 */
export type NoteOverrides = {
  detune?: number;
  lpfCutoffHz?: number;
  loop?: boolean;
  ampRelease?: number;
};

/**
 * Resolve the final VoiceParams for one matched region by merging four levels:
 *
 *   PARAM_DEFAULTS → json.defaults → group → region → noteOverrides
 *
 * Detune is computed in cents:
 *   (playedMidi - region.pitch + tune) * 100 + detune + noteOverrides.detune
 *
 * @param defaults  Global defaults from SmplrJson.defaults
 * @param group     The matched SmplrGroup
 * @param region    The matched SmplrRegion
 * @param midi      The played MIDI note number
 * @param velocity  The played velocity (0-127)
 * @param overrides Per-note overrides from the NoteEvent
 */
export function resolveParams(
  defaults: PlaybackParams | undefined,
  group: SmplrGroup,
  region: SmplrRegion,
  midi: number,
  velocity: number,
  overrides?: NoteOverrides
): VoiceParams {
  // Merge: hardcoded defaults → json.defaults → group → region
  const merged: Required<PlaybackParams> = {
    ...PARAM_DEFAULTS,
    ...defaults,
    ...pickPlaybackParams(group),
    ...pickPlaybackParams(region),
  };

  // Determine sample root pitch:
  // - region.pitch is the authoritative root MIDI note of the sample
  // - if absent, fall back to region.key (which sets both keyRange and pitch)
  // - if neither, assume the sample is tuned to the played note (no pitch shift)
  const pitch = region.pitch ?? region.key ?? midi;
  const semitones = midi - pitch;

  // Detune in cents: pitch transpose + tune offset (in semitones) + fine detune (cents)
  let detune = (semitones + merged.tune) * 100 + merged.detune;

  // Apply note-level overrides
  if (overrides?.detune !== undefined) detune += overrides.detune;

  return {
    detune,
    velocity,
    volume: merged.volume,
    ampRelease: overrides?.ampRelease ?? merged.ampRelease,
    ampAttack: merged.ampAttack,
    lpfCutoffHz: overrides?.lpfCutoffHz ?? merged.lpfCutoffHz,
    offset: merged.offset,
    loop: overrides?.loop ?? merged.loop,
    loopStart: merged.loopStart,
    loopEnd: merged.loopEnd,
    ampVelCurve: region.ampVelCurve,
    loopAuto: region.loopAuto,
  };
}
