import {
  AudioBuffers,
  getPreferredAudioExtension,
  loadAudioBuffer,
} from "./player/load-audio";
import { RegionGroup, SampleRegion } from "./player/types";
import { Storage } from "./storage";

export type SfzLoaderConfig = {
  urlFromSampleName: (sampleName: string, audioExt: string) => string;
  buffers: AudioBuffers;
  group: RegionGroup;
};

export function SfzInstrumentLoader(url: string, config: SfzLoaderConfig) {
  const audioExt = getPreferredAudioExtension();

  return async (context: BaseAudioContext, storage: Storage) => {
    const sfz = await fetch(url).then((res) => res.text());
    const errors = sfzToLayer(sfz, config.group);
    if (errors.length) {
      console.warn("Problems converting sfz", errors);
    }
    const sampleNames = new Set<string>();
    config.group.regions.forEach((r) => sampleNames.add(r.sampleName));
    return Promise.all(
      Array.from(sampleNames).map(async (sampleName) => {
        const sampleUrl = config.urlFromSampleName(sampleName, audioExt);
        const buffer = await loadAudioBuffer(context, sampleUrl, storage);
        config.buffers[sampleName] = buffer;
      })
    );
  };
}

export function sfzToLayer(sfz: string, group: RegionGroup) {
  let mode = "global";
  const tokens = sfz
    .split("\n")
    .map(parseToken)
    .filter((x): x is Token => !!x);

  const scope = new Scope();
  let errors: (string | undefined)[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "mode":
        errors.push(scope.closeScope(mode, group));
        mode = token.value;

        break;

      case "prop:num":
      case "prop:str":
      case "prop:num_arr":
        scope.push(token.key, token.value);
        break;

      case "unknown":
        console.warn("Unknown SFZ token", token.value);
        break;
    }
  }
  closeScope(mode, scope, group);

  return errors.filter((x) => !!x) as string[];

  function closeScope(mode: string, scope: Scope, group: RegionGroup) {}
}

type Token =
  | { type: "unknown"; value: string }
  | { type: "mode"; value: string }
  | { type: "prop:num"; key: string; value: number }
  | { type: "prop:num_arr"; key: string; value: [number, number] }
  | { type: "prop:str"; key: string; value: string };

const MODE_REGEX = /^<([^>]+)>$/;
const PROP_NUM_REGEX = /^([^=]+)=([-\.\d]+)$/;
const PROP_STR_REGEX = /^([^=]+)=(.+)$/;
const PROP_NUM_ARR_REGEX = /^([^=]+)_(\d+)=(\d+)$/;
function parseToken(line: string): Token | undefined {
  line = line.trim();
  if (line === "") return undefined;
  if (line.startsWith("//")) return undefined;

  const modeMatch = line.match(MODE_REGEX);
  if (modeMatch) return { type: "mode", value: modeMatch[1] };

  const propNumArrMatch = line.match(PROP_NUM_ARR_REGEX);
  if (propNumArrMatch)
    return {
      type: "prop:num_arr",
      key: propNumArrMatch[1],
      value: [Number(propNumArrMatch[2]), Number(propNumArrMatch[3])],
    };

  const propNumMatch = line.match(PROP_NUM_REGEX);
  if (propNumMatch)
    return {
      type: "prop:num",
      key: propNumMatch[1],
      value: Number(propNumMatch[2]),
    };

  const propStrMatch = line.match(PROP_STR_REGEX);
  if (propStrMatch)
    return {
      type: "prop:str",
      key: propStrMatch[1],
      value: propStrMatch[2],
    };

  return { type: "unknown", value: line };
}

type DestKey = keyof SampleRegion | "ignore";

class Scope {
  values: Record<string, any> = {};
  global: Partial<SampleRegion> = {};
  group: Partial<SampleRegion> = {};

  closeScope(mode: string, group: RegionGroup) {
    if (mode === "global") {
      // Save global properties
      this.#closeRegion(this.global as SampleRegion);
    } else if (mode === "group") {
      // Save group properties
      this.group = this.#closeRegion({} as SampleRegion);
    } else if (mode === "region") {
      const region = this.#closeRegion({
        sampleName: "",
        midiPitch: -1,
        ...this.global,
        ...this.group,
      });

      if (region.sampleName === "") {
        return "Missing sample name";
      }
      if (region.midiPitch === -1) {
        // By default, if pitch_keycenter is not specified, the sampler will often use the value
        // of lokey as the pitch key center.
        if (region.midiLow !== undefined) {
          region.midiPitch = region.midiLow;
        } else {
          return "Missing pitch_keycenter";
        }
      }

      // Set default sequence number
      if (region.seqLength && region.seqPosition === undefined) {
        region.seqPosition = 1;
      }

      // Move amp_release to sample options
      if (region.ampRelease) {
        region.sample = { decayTime: region.ampRelease };
        delete region.ampRelease;
      }
      group.regions.push(region);
    }
  }

  #closeRegion(region: SampleRegion) {
    this.popStr("sample", region, "sampleName");
    this.popNum("pitch_keycenter", region, "midiPitch");

    this.popNum("ampeg_attack", region, "ampAttack");
    this.popNum("ampeg_release", region, "ampRelease");
    this.popNum("bend_down", region, "bendDown");
    this.popNum("bend_up", region, "bendUp");
    this.popNum("group", region, "group");
    this.popNum("hikey", region, "midiHigh");
    this.popNum("hivel", region, "velHigh");
    this.popNum("lokey", region, "midiLow");
    this.popNum("offset", region, "offset");
    this.popNum("lovel", region, "velLow");
    this.popNum("off_by", region, "groupOffBy");
    this.popNum("pitch_keytrack", region, "ignore");
    this.popNum("seq_length", region, "seqLength");
    this.popNum("seq_position", region, "seqPosition");
    this.popNum("tune", region, "tune");
    this.popNum("volume", region, "volume");
    this.popNumArr("amp_velcurve", region, "ampVelCurve");

    // Enable only this while development
    // const remainingKeys = Object.keys(this.values);
    // if (remainingKeys.length) {
    //   console.warn("Remaining keys in scope: ", remainingKeys);
    // }
    this.values = {};
    return region;
  }

  get empty() {
    return Object.keys(this.values).length === 0;
  }

  get keys() {
    return Object.keys(this.values);
  }

  push(key: string, value: any) {
    this.values[key] = value;
  }

  popNum(key: string, dest: Record<string, any>, destKey: DestKey): boolean {
    if (typeof this.values[key] !== "number") return false;
    dest[destKey] = this.values[key];
    delete this.values[key];
    return true;
  }

  popStr(key: string, dest: Record<string, any>, destKey: DestKey): boolean {
    if (typeof this.values[key] !== "string") return false;
    dest[destKey] = this.values[key];
    delete this.values[key];
    return true;
  }

  popNumArr(key: string, dest: Record<string, any>, destKey: DestKey): boolean {
    if (!Array.isArray(this.values[key])) return false;
    dest[destKey] = this.values[key];
    delete this.values[key];
    return true;
  }
}
