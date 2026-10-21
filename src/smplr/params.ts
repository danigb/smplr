import { PlaybackParams, SmplrGroup, SmplrRegion, VoiceParams } from "./types";

/**
 * Hardcoded defaults — the baseline when nothing else is specified.
 */
export const PARAM_DEFAULTS: Required<PlaybackParams> = {
  volume: 0,
  pan: 0,
  tune: 0,
  detune: 0,
  ampDelay: 0,
  ampAttack: 0,
  ampHold: 0,
  ampDecay: 0,
  ampSustain: 1,
  ampRelease: 0.3,
  lpfCutoffHz: 20000,
  lpfQ: 1,
  modLfoToPitch: 0,
  modLfoToFilterFc: 0,
  modLfoToVolume: 0,
  // 8.176Hz is SF2's own "frequency generator = 0" reference (the same constant used for
  // absolute-cents-to-Hz conversion elsewhere)
  modLfoRateHz: 8.176,
  modLfoDelay: 0,
  vibLfoToPitch: 0,
  vibLfoRateHz: 8.176,
  vibLfoDelay: 0,
  modEnvToPitch: 0,
  modEnvToFilterFc: 0,
  modEnvDelay: 0,
  modEnvAttack: 0,
  modEnvHold: 0,
  modEnvDecay: 0,
  modEnvSustain: 1,
  modEnvRelease: 0,
  offset: 0,
  loop: false,
  loopStart: 0,
  loopEnd: 0,
  reverse: false,
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
  reverse?: boolean;
};

/**
 * Resolve the final VoiceParams for one matched region by merging four levels:
 *
 *   PARAM_DEFAULTS → json.defaults → group → region → noteOverrides
 *
 * Detune is computed in cents:
 *   (playedMidi - region.pitch + tune) * 100 + detune + noteOverrides.detune
 *
 * @param defaults  Global defaults from SmplrPreset.defaults
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
  overrides?: NoteOverrides,
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
    pan: merged.pan,
    ampDelay: merged.ampDelay,
    ampAttack: merged.ampAttack,
    ampHold: merged.ampHold,
    ampDecay: merged.ampDecay,
    ampSustain: merged.ampSustain,
    ampRelease: overrides?.ampRelease ?? merged.ampRelease,
    lpfCutoffHz: overrides?.lpfCutoffHz ?? merged.lpfCutoffHz,
    lpfQ: merged.lpfQ,
    modLfoToPitch: merged.modLfoToPitch,
    modLfoToFilterFc: merged.modLfoToFilterFc,
    modLfoToVolume: merged.modLfoToVolume,
    modLfoRateHz: merged.modLfoRateHz,
    modLfoDelay: merged.modLfoDelay,
    vibLfoToPitch: merged.vibLfoToPitch,
    vibLfoRateHz: merged.vibLfoRateHz,
    vibLfoDelay: merged.vibLfoDelay,
    modEnvToPitch: merged.modEnvToPitch,
    modEnvToFilterFc: merged.modEnvToFilterFc,
    modEnvDelay: merged.modEnvDelay,
    modEnvAttack: merged.modEnvAttack,
    modEnvHold: merged.modEnvHold,
    modEnvDecay: merged.modEnvDecay,
    modEnvSustain: merged.modEnvSustain,
    modEnvRelease: merged.modEnvRelease,
    offset: merged.offset,
    loop: overrides?.loop ?? merged.loop,
    loopStart: merged.loopStart,
    loopEnd: merged.loopEnd,
    loopAuto: region.loopAuto,
    reverse: overrides?.reverse ?? merged.reverse,
  };
}
