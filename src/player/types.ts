import { AudioBuffers } from "./load-audio";
import { Subscribe } from "./signals";

/**
 * @private
 */
export type InternalPlayer = {
  readonly buffers: AudioBuffers;
  readonly context: BaseAudioContext;
  start(sample: SampleStart): (time?: number) => void;
  stop(sample?: SampleStop): void;
  disconnect(): void;
};

export type SampleStop = {
  stopId?: string | number;
  time?: number;
};

export type SampleOptions = {
  decayTime?: number;
  detune?: number;
  // null can be used to override default
  duration?: number | null;
  velocity?: number;
  lpfCutoffHz?: number;
  loop?: boolean;
  loopStart?: number;
  loopEnd?: number;
  // not implemented yet
  gainOffset?: number;
};

export type SampleStart = {
  name?: string;
  note: string | number;
  onEnded?: (sample: SampleStart) => void;
  onStart?: (sample: SampleStart) => void;
  stop?: Subscribe<number>;
  stopId?: string | number;
  time?: number;
} & SampleOptions;

/**
 * Heavily inspired by SFZ format
 */
export type SampleRegion = {
  sampleName: string;

  /**
   * This specifies the MIDI key number that corresponds to the sample's original pitch
   */
  midiPitch: number;

  /**
   * This defines the lowest MIDI key number that will trigger this sample.
   */
  midiLow?: number;
  /**
   * This specifies the highest MIDI key number that will trigger this sample.
   */
  midiHigh?: number;

  velLow?: number;
  /**
   * This determines the highest MIDI velocity at which this sample will be triggered.
   */
  velHigh?: number;

  /**
   * These define the pitch bend range for the samples in this group. The values are given in cents
   */
  bendUp?: number;
  bendDown?: number;

  /**
   * Velocity-based amplitude scaling. [Vel, Gain] tells the sampler to play the sample
   * at volume Gain when the note's velocity is Vel
   */
  ampVelCurve?: [number, number];
  /**
   * Amplitude envelope release time in seconds.
   * Stored here for convenience (flatness) but needs to be
   * copied inside sample options before playback
   */
  ampRelease?: number;

  /**
   * Attack time in seconds. Currently not implemented
   *
   * @see http://sfzformat.com/opcodes/amp_attack.html
   */
  ampAttack?: number;

  /**
   * seqLength defines how many samples are in the sequence.
   * When using the seqPosition and seqLength , you can set up round-robin
   * or sequential sample playback.
   */
  seqLength?: number;

  /**
   * Determine the position of this particular sample within the sequence
   * 1 means first element of the sequence (not zero based!)
   */
  seqPosition?: number;

  /**
   * This assigns the group to a specific number.
   * Group numbers can be used in combination with groupOffBy to implement
   * exclusive groups, where playing one sample can stop another sample from playing.
   */
  group?: number;
  /**
   * Triggering a sample in this region will stop (or "turn off") any samples
   * currently playing in the specified group number
   */
  groupOffBy?: number;

  /**
   * Start offset (in samples). Not implemented (yet)
   */
  offset?: number;

  /**
   * Adjust the playback pitch of a sample (in semitones)
   */
  tune?: number;

  /**
   * The volume opcode in SFZ defines the default playback volume for a given region.
   * It specifies an adjustment to the sample's original amplitude.
   * The unit for the volume opcode is decibels (dB).
   */
  volume?: number;

  /**
   * sample options for this particular region
   */
  sample?: Partial<SampleOptions>;
};

export type RegionGroup = {
  regions: SampleRegion[];
  sample: Partial<SampleOptions>;
};
