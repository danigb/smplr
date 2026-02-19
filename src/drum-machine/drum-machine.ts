import { OutputChannel } from "../smplr/channel";
import { HttpStorage, Storage } from "../storage";
import { Smplr, SmplrOptions } from "../smplr";
import { LoadProgress, NoteEvent, SmplrGroup, SmplrJson, StopTarget } from "../smplr/types";
import {
  DrumMachineInstrument,
  EMPTY_INSTRUMENT,
  fetchDrumMachineInstrument,
  isDrumMachineInstrument,
} from "./dm-instrument";

export function getDrumMachineNames() {
  return Object.keys(INSTRUMENTS);
}

const INSTRUMENTS: Record<string, string> = {
  "TR-808": "https://smpldsnds.github.io/drum-machines/TR-808/dm.json",
  "Casio-RZ1": "https://smpldsnds.github.io/drum-machines/Casio-RZ1/dm.json",
  "LM-2": "https://smpldsnds.github.io/drum-machines/LM-2/dm.json",
  "MFB-512": "https://smpldsnds.github.io/drum-machines/MFB-512/dm.json",
  "Roland CR-8000":
    "https://smpldsnds.github.io/drum-machines/Roland-CR-8000/dm.json",
};

type DrumMachineConfig = {
  instrument: string | DrumMachineInstrument;
  url: string;
  storage: Storage;
};

export type DrumMachineOptions = Partial<
  DrumMachineConfig & {
    destination?: AudioNode;
    volume?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
  }
>;

function getConfig(options?: DrumMachineOptions): DrumMachineConfig {
  const config = {
    instrument: options?.instrument ?? "TR-808",
    storage: options?.storage ?? HttpStorage,
    url: options?.url ?? "",
  };
  if (typeof config.instrument === "string") {
    config.url ||= INSTRUMENTS[config.instrument];
    if (!config.url)
      throw new Error("Invalid instrument: " + config.instrument);
  } else if (!isDrumMachineInstrument(config.instrument)) {
    throw new Error("Invalid instrument: " + config.instrument);
  }

  return config;
}

export class DrumMachine {
  #smplr: Smplr;
  #instrument = EMPTY_INSTRUMENT;
  readonly load: Promise<this>;
  readonly output: OutputChannel;

  constructor(context: AudioContext, options?: DrumMachineOptions) {
    const config = getConfig(options);

    const smplrOptions: SmplrOptions = {
      destination: options?.destination,
      volume: options?.volume,
      velocity: options?.velocity,
      storage: config.storage,
      onLoadProgress: options?.onLoadProgress,
    };
    this.#smplr = new Smplr(context, smplrOptions);
    this.output = this.#smplr.output;

    const instrumentPromise = isDrumMachineInstrument(config.instrument)
      ? Promise.resolve(config.instrument)
      : fetchDrumMachineInstrument(config.url, config.storage);

    this.load = instrumentPromise
      .then((inst) => {
        this.#instrument = inst;
        return this.#smplr.loadInstrument(drumMachineToSmplrJson(inst));
      })
      .then(() => this);
  }

  getSampleNames(): string[] {
    return this.#instrument.samples.slice();
  }

  getGroupNames(): string[] {
    return this.#instrument.groupNames.slice();
  }

  getSampleNamesForGroup(groupName: string): string[] {
    return this.#instrument.sampleGroupVariations[groupName] ?? [];
  }

  start(sample: NoteEvent) {
    const s = typeof sample === "object" ? sample : { note: sample };
    return this.#smplr.start({
      ...s,
      stopId: (s as { stopId?: string | number; note: string | number }).stopId ?? s.note,
    });
  }

  stop(sample?: StopTarget) {
    return this.#smplr.stop(sample);
  }

  disconnect() {
    return this.#smplr.disconnect();
  }

  /** @deprecated */
  async loaded() {
    console.warn("deprecated: use load instead");
    return this.load;
  }

  /** @deprecated */
  get sampleNames(): string[] {
    console.log("deprecated: Use getGroupNames instead");
    return this.#instrument.groupNames.slice();
  }

  /** @deprecated */
  getVariations(groupName: string): string[] {
    console.warn("deprecated: use getSampleNamesForGroup");
    return this.#instrument.sampleGroupVariations[groupName] ?? [];
  }
}

// ---------------------------------------------------------------------------
// drumMachineToSmplrJson — pure converter function
// ---------------------------------------------------------------------------

/**
 * Convert a DrumMachineInstrument to a SmplrJson descriptor.
 *
 * Each sample gets a sequential MIDI number starting at 36 (GM drum map base).
 * Aliases are created for both the full sample name ("kick/1") and the group
 * name ("kick") so both forms work with Smplr.start({ note: "kick" }).
 */
export function drumMachineToSmplrJson(
  instrument: DrumMachineInstrument
): SmplrJson {
  const aliases: Record<string, number> = {};
  const regions: SmplrGroup["regions"] = [];

  const BASE_MIDI = 36;

  instrument.samples.forEach((sampleName, i) => {
    const midi = BASE_MIDI + i;

    // Full sample name alias: "kick/1" → midi
    aliases[sampleName] = midi;

    regions.push({
      sample: sampleName,
      keyRange: [midi, midi],
      pitch: midi,
    });
  });

  // Group name aliases: "kick" → first sample MIDI
  for (const [groupName, firstSample] of Object.entries(
    instrument.nameToSampleName
  )) {
    if (firstSample) {
      const idx = instrument.samples.indexOf(firstSample);
      if (idx >= 0) {
        aliases[groupName] = BASE_MIDI + idx;
      }
    }
  }

  return {
    samples: {
      baseUrl: instrument.baseUrl,
      formats: ["ogg", "m4a"],
    },
    groups: [{ regions }],
    aliases,
  };
}
