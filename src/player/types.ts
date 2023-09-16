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
};

export type SampleStart = {
  name?: string;
  note: string | number;
  onEnded?: (sample: SampleStart) => void;
  stop?: Subscribe<number>;
  stopId?: string | number;
  time?: number;
} & SampleOptions;

export type SamplePlayerOptions = {
  velocityToGain?: (velocity: number) => number;
} & SampleOptions;

export type SampleRegion = {
  sampleName: string;
  midiPitch: number;
  midiLow?: number;
  midiHigh?: number;
  velLow?: number;
  velHigh?: number;
  offsetVol?: number;
  offsetDetune?: number;
  sample?: Partial<SampleOptions>;
};

export type SampleLayer = {
  regions: SampleRegion[];
  sample: Partial<SampleOptions>;
};
