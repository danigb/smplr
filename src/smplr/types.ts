/**
 * Inheritable playback parameters. Can appear at global defaults, group, or region level.
 * More specific levels override less specific ones.
 */
export type PlaybackParams = {
  volume?: number; // dB adjustment (0 = no change)
  tune?: number; // pitch adjustment in semitones
  detune?: number; // fine pitch adjustment in cents
  ampRelease?: number; // release envelope time in seconds
  ampAttack?: number; // attack time in seconds (not yet implemented)
  lpfCutoffHz?: number; // low-pass filter cutoff frequency in Hz
  offset?: number; // start playback from this position in sample frames
  loop?: boolean;
  loopStart?: number; // sample frames, or 0-1 as fraction of buffer duration
  loopEnd?: number; // sample frames, or 0-1 as fraction of buffer duration (0 = end)
};

/**
 * An individual sample region. Maps a sample to a range of notes and velocities.
 */
export type SmplrRegion = PlaybackParams & {
  sample: string; // buffer key (from samples.map) or relative path
  key?: number; // shorthand: sets keyRange=[key,key] and pitch=key
  keyRange?: [number, number]; // [low, high] MIDI note range
  pitch?: number; // root MIDI pitch of the sample (used to calculate detune)
  velRange?: [number, number]; // [low, high] velocity range
  ccRange?: Record<string, [number, number]>; // CC number → [low, high]
  seqPosition?: number; // 1-based position in round-robin sequence
  group?: number; // exclusive group membership
  offBy?: number; // triggering this stops voices in this group number
  trigger?: "first" | "legato";
  ampVelCurve?: [number, number]; // [velocity, gain] — single-point velocity curve
  /** Auto-compute loop points from buffer duration ratios (0–1). */
  loopAuto?: { startRatio: number; endRatio: number };
};

/**
 * A group of regions sharing common constraints and defaults.
 */
export type SmplrGroup = PlaybackParams & {
  label?: string;
  keyRange?: [number, number]; // group-level key range filter
  velRange?: [number, number]; // group-level velocity range filter
  ccRange?: Record<string, [number, number]>; // group-level CC range filter
  seqLength?: number; // total number of round-robin variations in this group
  group?: number; // exclusive group number for all regions in this group
  offBy?: number; // triggering any region here stops voices in this group
  trigger?: "first" | "legato";
  regions: SmplrRegion[];
};

/**
 * Defines where and how to locate sample audio files.
 */
export type SmplrSamples = {
  baseUrl: string; // prepended to all sample paths
  formats: string[]; // audio formats in preference order; first supported by browser wins
  map?: Record<string, string>; // sample name → relative path (without extension)
};

/**
 * The top-level smplr.json descriptor. Passed to the Smplr constructor.
 */
export type SmplrJson = {
  meta?: {
    name?: string;
    description?: string;
    license?: string;
    source?: string;
    tags?: string[];
  };
  samples: SmplrSamples;
  defaults?: PlaybackParams;
  groups: SmplrGroup[];
  /** Maps arbitrary string keys to MIDI numbers, resolved before toMidi(). */
  aliases?: Record<string, number>;
};

/**
 * A note event passed to Smplr.start(). Can be a full object, a note name, or a MIDI number.
 */
export type NoteEvent =
  | {
      note: string | number;
      velocity?: number; // 0-127
      time?: number; // AudioContext time; defaults to now
      duration?: number | null; // auto-stop after N seconds; null disables
      detune?: number; // additional cents, added to region detune
      lpfCutoffHz?: number; // per-note LPF override
      loop?: boolean; // per-note loop override
      ampRelease?: number; // per-note release override
      stopId?: string | number; // key for targeted stop; defaults to note
    }
  | string
  | number;

/**
 * Target for Smplr.stop(). Can be a full object, a stopId, or a MIDI number.
 */
export type StopTarget =
  | {
      stopId?: string | number;
      time?: number; // schedule the stop at a future AudioContext time
    }
  | string
  | number;

/**
 * Function returned by Smplr.start(). Calling it stops the started voices.
 */
export type StopFn = (time?: number) => void;

/**
 * Loading progress snapshot. total is known before loading starts.
 */
export type LoadProgress = {
  loaded: number; // number of buffers decoded so far
  total: number; // total number of buffers to load
};

/**
 * Fully resolved playback parameters for a single Voice.
 * Output of resolveParams() — all fields are required, no optionals except ampVelCurve/loopAuto.
 */
export type VoiceParams = {
  detune: number; // cents (pitch transpose + tune + detune + note override)
  velocity: number; // 0-127
  volume: number; // dB gain adjustment
  ampRelease: number; // release envelope time in seconds
  ampAttack: number; // attack time in seconds
  lpfCutoffHz: number; // low-pass filter cutoff in Hz
  offset: number; // start position in sample frames
  loop: boolean;
  loopStart: number; // sample frames
  loopEnd: number; // sample frames (0 = end of buffer)
  ampVelCurve?: [number, number]; // [velocity, gain] single-point velocity curve
  /** If set, loop points are computed from buffer.duration at play time. */
  loopAuto?: { startRatio: number; endRatio: number };
};
