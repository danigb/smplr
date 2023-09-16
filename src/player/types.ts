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
  sample_name: string;
  sample_center: number;
  range_midi?: [number, number];
  range_vol?: [number, number];
  offset_vol?: number;
  offset_detune?: number;
};

export type SampleLayer = {
  regions: SampleRegion[];
  options?: Partial<SampleOptions>;
};
