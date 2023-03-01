export type Websfz = {
  global: Record<string, string | number>;
  groups: WebsfzGroup[];
  meta: {
    name?: string;
    description?: string;
    license?: string;
    source?: string;
    baseUrl?: string;
    websfzUrl?: string;
    formats?: string[];
    tags?: string[];
  };
};

export type WebsfzGroup = {
  group_label?: string;
  group?: number;
  hikey?: number;
  hivel?: number;
  lokey?: number;
  lovel?: number;
  off_by?: number;
  off_mode?: "normal";
  pitch_keycenter?: number;
  regions: WebsfzRegion[];
  seq_length?: number;
  trigger?: "first" | "legato";
  volume?: number;
  amp_velcurve_83?: number;

  // FIXME: find a way to type this dynamic modifiers
  locc64?: number;
  hicc64?: number;
  hicc107?: number;
  locc107?: number;
  pan_oncc122?: number;
  tune_oncc123?: number;
  eg06_time1_oncc109?: number;
  ampeg_attack_oncc100?: number;
};

export type WebsfzRegion = {
  end?: number;
  group?: number;
  hivel?: number;
  lovel?: number;
  hikey?: number;
  key?: number;
  lokey?: number;
  off_by?: number;
  pitch_keycenter?: number;
  region_label?: number;
  sample: string;
  seq_position?: number;
  trigger?: "first" | "legato";
  volume?: number;

  // FIXME: find a way to type this dynamic modifiers
  locc64?: number;
  hicc64?: number;
  ampeg_attack_oncc100?: number;
  eg06_time1_oncc109?: number;
  pan_oncc122?: number;
  tune_oncc123?: number;
};
