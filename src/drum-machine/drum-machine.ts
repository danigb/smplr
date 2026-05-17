import { HttpStorage, Storage } from "../storage";
import { Instrument } from "../smplr";
import {
  LoadProgress,
  NoteEvent,
  SmplrGroup,
  SmplrPreset,
  StopFn,
} from "../smplr/types";
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
    pan?: number;
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

type DrumMachineExtras = {
  getSampleNames(): string[];
  getGroupNames(): string[];
  getSampleNamesForGroup(groupName: string): string[];
  start(event: NoteEvent): StopFn;
};

export const DrumMachine = Instrument(
  (ctx: BaseAudioContext, options: DrumMachineOptions = {}, smplr) => {
    const config = getConfig(options);

    // Mutable closure state — extras read this; the load promise populates it.
    let instrument: DrumMachineInstrument = EMPTY_INSTRUMENT;

    // Capture the base `start` *before* Object.assign(smplr, extras) shadows
    // it — otherwise the override below would recurse into itself.
    const baseStart = smplr.start.bind(smplr);

    const extras: DrumMachineExtras = {
      getSampleNames: () => instrument.samples.slice(),
      getGroupNames: () => instrument.groupNames.slice(),
      getSampleNamesForGroup: (groupName) =>
        instrument.sampleGroupVariations[groupName] ?? [],

      // Override start() to inject stopId so re-triggering the same drum
      // cuts the previous voice (one-shot-per-drum semantic).
      start: (sample) => {
        const s = typeof sample === "object" ? sample : { note: sample };
        return baseStart({
          ...s,
          stopId:
            (s as { stopId?: string | number; note: string | number }).stopId ??
            s.note,
        });
      },
    };

    const instrumentPromise = isDrumMachineInstrument(config.instrument)
      ? Promise.resolve(config.instrument)
      : fetchDrumMachineInstrument(config.url, config.storage);

    const ready = instrumentPromise.then((inst) => {
      instrument = inst;
      return smplr.loadInstrument(drumMachineToPreset(inst));
    });

    return { extras, ready };
  },
);

/** Instance type returned by the {@link DrumMachine} factory. */
export type DrumMachine = ReturnType<typeof DrumMachine>;

// ---------------------------------------------------------------------------
// drumMachineToPreset — pure converter function
// ---------------------------------------------------------------------------

/**
 * Convert a DrumMachineInstrument to a SmplrPreset descriptor.
 *
 * Each sample gets a sequential MIDI number starting at 36 (GM drum map base).
 * Aliases are created for both the full sample name ("kick/1") and the group
 * name ("kick") so both forms work with Smplr.start({ note: "kick" }).
 */
export function drumMachineToPreset(
  instrument: DrumMachineInstrument,
): SmplrPreset {
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
    instrument.nameToSampleName,
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
