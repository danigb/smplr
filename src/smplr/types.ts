/**
 * Inheritable playback parameters. Can appear at global defaults, group, or region level.
 * More specific levels override less specific ones.
 */
export type PlaybackParams = {
  volume?: number; // dB adjustment (0 = no change)
  pan?: number; // stereo position: -1 (full left) to 1 (full right), 0 = center
  tune?: number; // pitch adjustment in semitones
  detune?: number; // fine pitch adjustment in cents
  ampDelay?: number; // silence before the attack phase starts, in seconds
  ampAttack?: number; // attack time in seconds
  ampHold?: number; // time held at peak (1.0) before decay starts, in seconds
  ampDecay?: number; // time for a *full* decay (1 -> 0), in seconds; falling to ampSustain takes ampDecay * (1 - ampSustain)
  ampSustain?: number; // level held after decay, until note-off (0-1, 1 = no decay)
  ampRelease?: number; // release envelope time in seconds
  lpfCutoffHz?: number; // low-pass filter cutoff frequency in Hz
  lpfQ?: number; // low-pass filter resonance in dB (BiquadFilterNode.Q); 0 = no peak, the default of 1 gives a small one. SF2's initialFilterQ is in centibels: divide by 10
  // Modulation LFO -> pitch / filter cutoff / volume (tremolo). All three destinations share
  // one oscillator. Filter and volume depths are linear approximations of SF2's exponential
  // units (cents/centibels), since Web Audio sums LFO signals linearly onto frequency/gain -
  // accurate for modest depths, less so for extreme sweeps. Pitch is exact (detune is cents-native).
  // Filter and volume depths are clamped to the base cutoff / gain, so they never go below 0. A
  // negative modEnvToFilterFc lowers the real cutoff below that base, though: a deep filter LFO
  // combined with it can still close the filter instead of wobbling it.
  // Pitch destinations (modLfoToPitch, vibLfoToPitch, modEnvToPitch) need
  // AudioBufferSourceNode.detune and are skipped where it is missing (old Safari).
  modLfoToPitch?: number; // pitch modulation depth in cents (peak deviation); 0 = no effect
  modLfoToFilterFc?: number; // filter cutoff modulation depth in cents (peak deviation); 0 = no effect
  modLfoToVolume?: number; // volume (tremolo) modulation depth in centibels (peak deviation); 0 = no effect
  modLfoRateHz?: number; // modulation LFO rate in Hz
  modLfoDelay?: number; // silence before the modulation LFO starts, in seconds
  // Vibrato LFO -> pitch: a second, independent LFO dedicated to pitch (SF2 models these as
  // two separate oscillators that can run at different rates/depths simultaneously).
  vibLfoToPitch?: number; // pitch modulation depth in cents (peak deviation); 0 = no effect
  vibLfoRateHz?: number; // vibrato LFO rate in Hz
  vibLfoDelay?: number; // silence before the vibrato LFO starts, in seconds
  // Modulation envelope -> pitch / filter cutoff: a second, independent delay/attack/hold/
  // decay/sustain/release envelope (same shape as ampAttack etc. above) that can shape pitch
  // and/or filter cutoff over time. Filter depth is a linear approximation,
  // same caveat as the LFO's filter destination above.
  modEnvToPitch?: number; // pitch modulation depth in cents (peak deviation); 0 = no effect
  modEnvToFilterFc?: number; // filter cutoff modulation depth in cents (peak deviation); 0 = no effect
  modEnvDelay?: number; // seconds of silence before the modulation envelope's attack starts
  modEnvAttack?: number; // seconds to ramp the modulation envelope 0 -> 1
  modEnvHold?: number; // seconds held at peak before the modulation envelope's decay starts
  modEnvDecay?: number; // seconds for a *full* (100%) decay - see computeAdsrTimes in envelope.ts
  modEnvSustain?: number; // level held after decay, until note-off (0-1, 1 = no decay)
  modEnvRelease?: number; // seconds for the modulation envelope to fade to 0 after note-off
  offset?: number; // start playback from this position in seconds
  loop?: boolean;
  loopStart?: number; // loop start in seconds
  loopEnd?: number; // loop end in seconds (0 = end of buffer)
  reverse?: boolean; // play the sample backwards
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
export type SmplrPreset = {
  /** Schema version. Omit for the current format. Reserved for future migrations. */
  smplr?: "1.0";
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
      onStart?: (event: NoteEvent) => void; // called when the note is dispatched
      onEnded?: (event: NoteEvent) => void; // called when each voice's audio ends
      reverse?: boolean; // play the sample backwards
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
 * Output of resolveParams() — all fields are required, no optionals except loopAuto.
 */
export type VoiceParams = {
  detune: number; // cents (pitch transpose + tune + detune + note override)
  velocity: number; // 0-127
  volume: number; // dB gain adjustment
  pan: number; // stereo position: -1 (full left) to 1 (full right), 0 = center
  ampDelay: number; // silence before the attack phase starts, in seconds
  ampAttack: number; // attack time in seconds
  ampHold: number; // time held at peak (1.0) before decay starts, in seconds
  ampDecay: number; // time for a *full* decay (1 -> 0), in seconds; falling to ampSustain takes ampDecay * (1 - ampSustain)
  ampSustain: number; // level held after decay, until note-off (0-1, 1 = no decay)
  ampRelease: number; // release envelope time in seconds
  lpfCutoffHz: number; // low-pass filter cutoff in Hz
  lpfQ: number; // low-pass filter resonance in dB (BiquadFilterNode.Q); 0 = no peak, the default of 1 gives a small one. SF2's initialFilterQ is in centibels: divide by 10
  modLfoToPitch: number; // pitch modulation depth in cents; 0 = no LFO
  modLfoToFilterFc: number; // filter cutoff modulation depth in cents; 0 = no effect
  modLfoToVolume: number; // volume (tremolo) modulation depth in centibels; 0 = no effect
  modLfoRateHz: number; // modulation LFO rate in Hz
  modLfoDelay: number; // silence before the modulation LFO starts, in seconds
  vibLfoToPitch: number; // pitch modulation depth in cents; 0 = no LFO
  vibLfoRateHz: number; // vibrato LFO rate in Hz
  vibLfoDelay: number; // silence before the vibrato LFO starts, in seconds
  modEnvToPitch: number; // pitch modulation depth in cents; 0 = no effect
  modEnvToFilterFc: number; // filter cutoff modulation depth in cents; 0 = no effect
  modEnvDelay: number; // seconds of silence before the modulation envelope's attack starts
  modEnvAttack: number; // seconds to ramp the modulation envelope 0 -> 1
  modEnvHold: number; // seconds held at peak before the modulation envelope's decay starts
  modEnvDecay: number; // seconds for a *full* (100%) decay
  modEnvSustain: number; // level held after decay, until note-off (0-1, 1 = no decay)
  modEnvRelease: number; // seconds for the modulation envelope to fade to 0 after note-off
  offset: number; // start position in seconds
  loop: boolean;
  loopStart: number; // seconds
  loopEnd: number; // seconds (0 = end of buffer)
  /** If set, loop points are computed from buffer.duration at play time. */
  loopAuto?: { startRatio: number; endRatio: number };
  reverse?: boolean; // buffer passed in is already reversed; mirror offset if needed
};
