import { Subscribe } from "./signals";

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
};

export type SampleStart = {
  note: string | number;
  onEnded?: (sample: SampleStart) => void;
  stop?: Subscribe<number>;
  stopId?: string | number;
  time?: number;
} & SampleOptions;

export type SamplePlayerOptions = {
  velocityToGain?: (velocity: number) => number;
} & SampleOptions;
