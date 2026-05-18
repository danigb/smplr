// DrumAbuse — smplr instrument for the Synthabuse drum-machine sample collection.
//
import { HttpStorage, type Storage } from "../storage";
import { Instrument } from "../smplr";
import type {
  LoadProgress,
  NoteEvent,
  SmplrPreset,
  StopFn,
} from "../smplr/types";

const DEFAULT_BASE_URL = "https://smpldsnds.github.io";
const MIDI_BASE = 36;

export const DRUM_ABUSE_PACKS = [
  "vol1",
  "vol2",
  "vol3",
  "vol4",
  "vol5",
] as const;
export type DrumAbusePackId = (typeof DRUM_ABUSE_PACKS)[number];

const MACHINES_BY_PACK: Record<DrumAbusePackId, readonly string[]> = {
  vol1: [
    "4-inthefloor-percussioncombo",
    "ace-tone-rhythm-ace-fr-1",
    "ace-tone-rhythm-ace-fr-7l",
    "ace-tone-rhythm-ace-fr6",
    "ace-tone-rhythm-king",
    "ace-tone-rhythm-master",
    "antonelli-2377",
    "arp-axxe",
    "conn-min-o-matic",
    "eko-compu-rhythm",
    "eko-ritmo-12",
    "eko-ritmo-20",
    "elgam-carousel",
    "emu-modular",
    "farfisa-pro",
    "farfisa-rhythm-10",
    "farfisa-rhythm-maker-16",
    "gibson-maestro-g-2",
    "gibson-maestro-rhythm-jester",
    "gibson-maestro-rhythm-king-mrk-1",
    "gulbransen-organ",
    "hammond-rhythm",
    "hammond-rhythm-ii",
    "hohner-automatic-rhythm-player",
    "jen-sx-1000",
    "kay-r-8",
    "keio-checkmate",
    "kent-k-200",
    "kent-rhythm-master",
    "korg-kr-33",
    "korg-krz",
    "korg-minipops-series",
    "korg-s-3",
    "korg-univox-micro-rhythmer-12",
    "korg-univox-sr-120",
    "korg-univox-sr-95",
    "luxor-passat",
    "moog-modular-55",
    "roland-arr",
    "roland-edp-1",
    "roland-sh-3a",
    "roland-system-100",
    "roland-tr-1-prototype",
    "roland-tr-33",
    "roland-tr-41-prototype",
    "roland-tr-66",
    "roland-tr-77",
    "seeburg-rhythm-prince",
    "seeburg-select-a-rhythm",
    "solton-disco-64",
    "sonor-mini-mammut-module",
    "video-tech-rythmic-10",
    "vox-percussion-king",
    "whippany-melo-sonic-350",
    "wurlitzer-swinging-rhythm",
    "yamaha-cs-15d",
    "yamaha-cs-5",
    "yamaha-cs-6",
    "yamaha-ps-1",
    "yamaha-ps-2",
    "yamaha-ps-3",
  ],
  vol2: [
    "bontempi-hf222",
    "boss-dr-55",
    "casio-mt-18",
    "casio-pt-30",
    "casio-vl-1",
    "chaser-computer-drum-pr-80",
    "crb-rhythmboy-480",
    "eko-musicbox-12",
    "electro-harmonix-drm-15",
    "electro-harmonix-drm-16",
    "electro-harmonix-spacedrum",
    "elka-drumstar-80",
    "elka-x-1000",
    "emu-e-drum",
    "gem-drum-15",
    "hammond-autovari-64",
    "hohner-rhythm-80k",
    "korg-kpr-77",
    "korg-kr-55",
    "korg-kr-mini",
    "korg-monopoly",
    "korg-ms-10",
    "korg-trident",
    "linn-lm-1",
    "monacor-rhythmical-choice",
    "mti-auto-orchestra-ao-1",
    "multi-moog",
    "mxr-185",
    "new-england-digital-synclavier",
    "oberheim-dmx",
    "pearl-drum-x",
    "pollard-syndrum-178",
    "roland-cr-1000",
    "roland-cr-68",
    "roland-cr-78",
    "roland-cr-80",
    "roland-cr-8000",
    "roland-dr-55",
    "roland-jupiter-8",
    "roland-pb-300-rhythm-plus",
    "roland-rhy-33",
    "roland-rhy-55",
    "roland-sh-09",
    "roland-tr-55",
    "roland-tr-606",
    "roland-tr-808",
    "simmons-drum",
    "simmons-sds-1",
    "simmons-sds-5",
    "solton-programmer-24",
    "star-instruments-synare-3",
    "star-instruments-synare-ps-1",
    "visco-space-drum",
    "watford-electronics-rhythm-generator",
    "yamaha-cs-40m",
    "yamaha-mr-10",
    "yamaha-ps-55",
  ],
  vol3: [
    "amdek-pck-100",
    "austin-arb-6",
    "bme-rattlesnake-parametric-percussion-system",
    "boss-dr-110",
    "casio-mt-100",
    "coron-drumsynce-ds-7",
    "coron-rds",
    "denon-crb-90",
    "drumfire-df-2000",
    "drumfire-df-500",
    "electro-harmonix-drm-32",
    "emu-drumulator",
    "kay-drm-1",
    "korg-ddm-110",
    "korg-ddm-220",
    "korg-poly-800",
    "linn-linndrum-lm-1-vinyl",
    "linn-lm-2",
    "mattel-electronics-synsonics-drm",
    "mattel-electronics-synsonics-pro",
    "panasonic-rd-9844",
    "pearl-drx-1",
    "roland-ddr-30",
    "roland-mc-202",
    "roland-rhy-77",
    "roland-tr-909",
    "rsf-dd-30",
    "sakata-dpm-48",
    "sequential-circuits-drumtraks",
    "simmons-clap-trap",
    "simmons-sds-200",
    "simmons-sds-400",
    "soundmaster-sm-8",
    "soundmaster-sr-88",
    "tama-ts-206",
    "tama-ts-305",
    "wersi-wm-24",
    "yamaha-dx7",
  ],
  vol4: [
    "atlantex-mpc-1",
    "boss-hc-2",
    "boss-pc-2",
    "casio-ct-310",
    "casio-mt-500",
    "casio-mt-800",
    "casio-pt-68",
    "casio-pt-82",
    "casio-sk-1",
    "dr-b-hm-digital-drums",
    "emu-sp-12",
    "ensoniq-mirage",
    "hing-hon-ek-001",
    "kawai-acr-20",
    "kawai-sx-240",
    "klone-dual-percussion-synthesiser",
    "korg-ddd-1",
    "korg-pss-50",
    "kurzweil-electrodrum-prototype",
    "linn-9000",
    "linn-linndrum-lm-2-vinyl",
    "nasta-hitstix-2",
    "oberheim-dx",
    "pearl-sc-40",
    "rhodes-polaris",
    "roland-juno-106",
    "roland-super-quartet-mks-7",
    "roland-tr-707",
    "roland-tr-727",
    "siel-mdp-40",
    "simmons-sds-1000",
    "simmons-sds-7",
    "simmons-sds-8",
    "simmons-sds-9",
    "sony-drp-1",
    "soundmaster-stix-st-305",
    "suzuki-rpm-40",
    "tama-ts-500",
    "technics-ax-5",
    "technics-pcm-dp-50",
    "wersi-prisma-dx-5",
    "yamaha-dd-5",
    "yamaha-rx-11",
    "yamaha-rx-15",
    "yamaha-rx-21",
    "yamaha-rx-5",
  ],
  vol5: [
    "boss-dr-pad-drp-i",
    "casio-ct-403",
    "casio-cz-230s",
    "casio-ht-700",
    "casio-rz-1",
    "cheetah-spec-drum",
    "forat-f-9000",
    "korg-ddd-5",
    "korg-dss-1",
    "m-p-c-electronics-dsm-1",
    "pearl-sy-1",
    "roland-tr-505",
    "sequential-circuits-studio-440",
    "simmons-sds-2000",
    "simmons-sdx",
    "yamaha-pss-130",
    "yamaha-ptx8",
    "yamaha-rx-21l",
  ],
};

const machineToPack: ReadonlyMap<string, DrumAbusePackId> = (() => {
  const m = new Map<string, DrumAbusePackId>();
  for (const pack of DRUM_ABUSE_PACKS) {
    for (const id of MACHINES_BY_PACK[pack]) m.set(id, pack);
  }
  return m;
})();

export function getDrumAbuseMachineNames(): string[] {
  return [...machineToPack.keys()];
}

export function getDrumAbuseMachinesForPack(
  pack: DrumAbusePackId,
): readonly string[] {
  return MACHINES_BY_PACK[pack];
}

export function getDrumAbusePackNames(): readonly DrumAbusePackId[] {
  return DRUM_ABUSE_PACKS;
}

export function getDrumAbuseMachinePack(
  id: string,
): DrumAbusePackId | undefined {
  return machineToPack.get(id);
}

// ---- URL helpers ------------------------------------------------------------

const encSeg = (s: string) => s.split("/").map(encodeURIComponent).join("/");

function packBase(baseUrl: string, pack: DrumAbusePackId): string {
  return `${baseUrl}/drum-abuse-${pack}`;
}

function sampleBaseUrl(
  baseUrl: string,
  pack: DrumAbusePackId,
  urlPath: string,
): string {
  return `${packBase(baseUrl, pack)}/samples/${encSeg(urlPath)}/`;
}

/** Build a full sample URL. Exported so external row-level Sampler use
 * (e.g. the sequencer engine) can share the same URL convention. */
export function drumAbuseSampleUrl(
  pack: DrumAbusePackId,
  urlPath: string,
  fileNoExt: string,
  format = "wav",
  baseUrl = DEFAULT_BASE_URL,
): string {
  return `${sampleBaseUrl(baseUrl, pack, urlPath)}${encodeURIComponent(fileNoExt)}.${format}`;
}

function stripExt(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

// ---- Repo JSON types (private) ---------------------------------------------

type RepoSampleSet = {
  path: string;
  set: string;
  url_path: string;
  samples: string[];
  sample_instruments: string[];
};

type RepoMachine = {
  id: string;
  sample_sets: RepoSampleSet[];
};

type RepoPackSample = {
  machine_id: string;
  url_path: string;
  file: string;
};

// ---- Fetch layer ------------------------------------------------------------

const jsonCache = new Map<string, Promise<unknown>>();

function fetchJSON<T>(url: string, storage: Storage): Promise<T> {
  let p = jsonCache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = storage.fetch(url).then((r) => {
      if (r.status >= 400) throw new Error(`DrumAbuse: ${r.status} ${url}`);
      return r.json() as Promise<T>;
    });
    jsonCache.set(url, p);
  }
  return p;
}

// ---- Preset builders --------------------------------------------------------

type BuiltPreset = {
  preset: SmplrPreset;
  sampleNames: string[];
  groupNames: string[];
  sampleNamesForGroup: Record<string, string[]>;
  setPath: string | null;
};

function buildMachinePreset(
  machine: RepoMachine,
  setPath: string | undefined,
  baseUrl: string,
  pack: DrumAbusePackId,
): BuiltPreset {
  if (machine.sample_sets.length === 0) {
    throw new Error(`DrumAbuse: machine "${machine.id}" has no sample sets`);
  }
  const set = setPath
    ? machine.sample_sets.find((s) => s.path === setPath)
    : machine.sample_sets[0];
  if (!set) {
    throw new Error(`DrumAbuse: set "${setPath}" not found on "${machine.id}"`);
  }
  if (set.samples.length === 0) {
    throw new Error(
      `DrumAbuse: set "${set.path}" of "${machine.id}" has no samples`,
    );
  }

  const sampleNames: string[] = [];
  const groupNames: string[] = [];
  const sampleNamesForGroup: Record<string, string[]> = {};
  const aliases: Record<string, number> = {};
  const regions = set.samples.map((file, i) => {
    const key = stripExt(file);
    const midi = MIDI_BASE + i;
    sampleNames.push(key);
    aliases[key] = midi;
    const group = set.sample_instruments[i] || "";
    if (group) {
      if (!sampleNamesForGroup[group]) {
        sampleNamesForGroup[group] = [];
        groupNames.push(group);
        aliases[group] = midi;
      }
      sampleNamesForGroup[group].push(key);
    }
    return {
      sample: key,
      keyRange: [midi, midi] as [number, number],
      pitch: midi,
    };
  });

  return {
    preset: {
      samples: {
        baseUrl: sampleBaseUrl(baseUrl, pack, set.url_path),
        formats: ["wav"],
      },
      groups: [{ regions }],
      aliases,
    },
    sampleNames,
    groupNames,
    sampleNamesForGroup,
    setPath: set.path,
  };
}

function buildPackPreset(
  list: RepoPackSample[],
  baseUrl: string,
  pack: DrumAbusePackId,
): BuiltPreset {
  if (list.length === 0) {
    throw new Error(`DrumAbuse: empty pack-instrument list for pack "${pack}"`);
  }

  // First pass: count filename collisions so unique short aliases stay unique.
  const fileCount: Record<string, number> = {};
  for (const s of list) {
    const f = stripExt(s.file);
    fileCount[f] = (fileCount[f] ?? 0) + 1;
  }

  const sampleNames: string[] = [];
  const groupNames: string[] = [];
  const sampleNamesForGroup: Record<string, string[]> = {};
  const map: Record<string, string> = {};
  const aliases: Record<string, number> = {};

  const regions = list.map((s, i) => {
    const fileKey = stripExt(s.file);
    const uniqueKey = `${s.machine_id}/${fileKey}`;
    const midi = MIDI_BASE + i;
    sampleNames.push(uniqueKey);
    aliases[uniqueKey] = midi;
    if (fileCount[fileKey] === 1) aliases[fileKey] = midi;
    map[uniqueKey] =
      `${packBase(baseUrl, pack)}/samples/${encSeg(s.url_path)}/${encodeURIComponent(s.file)}`;

    if (!sampleNamesForGroup[s.machine_id]) {
      sampleNamesForGroup[s.machine_id] = [];
      groupNames.push(s.machine_id);
      aliases[s.machine_id] = midi;
    }
    sampleNamesForGroup[s.machine_id].push(uniqueKey);

    return {
      sample: uniqueKey,
      keyRange: [midi, midi] as [number, number],
      pitch: midi,
    };
  });

  return {
    preset: {
      samples: { baseUrl: "", formats: ["wav"], map },
      groups: [{ regions }],
      aliases,
    },
    sampleNames,
    groupNames,
    sampleNamesForGroup,
    setPath: null,
  };
}

// ---- DrumAbuse factory ------------------------------------------------------

export type DrumAbuseSource =
  | { kind: "machine"; machine: string; set?: string }
  | { kind: "pack"; pack: DrumAbusePackId; instrument: string };

export type DrumAbuseConfig = {
  source: DrumAbuseSource;
  baseUrl: string;
  storage: Storage;
};

export type DrumAbuseOptions = Partial<
  DrumAbuseConfig & {
    destination?: AudioNode;
    volume?: number;
    pan?: number;
    velocity?: number;
    onLoadProgress?: (progress: LoadProgress) => void;
  }
>;

export type DrumAbuseExtras = {
  readonly mode: "machine" | "pack";
  getSampleNames(): string[];
  getGroupNames(): string[];
  getSampleNamesForGroup(groupName: string): string[];
  getMachineId(): string | null;
  getSetPath(): string | null;
  getPackId(): DrumAbusePackId;
  start(event: NoteEvent): StopFn;
};

export const DrumAbuse = Instrument<DrumAbuseOptions, DrumAbuseExtras>(
  (_ctx, options = {}, smplr) => {
    const source = options.source;
    if (!source) {
      throw new Error("DrumAbuse: options.source is required");
    }
    const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    const storage = options.storage ?? HttpStorage;

    let sampleNames: string[] = [];
    let groupNames: string[] = [];
    let sampleNamesForGroup: Record<string, string[]> = {};
    let machineId: string | null = null;
    let setPath: string | null = null;
    let packId: DrumAbusePackId;
    let mode: "machine" | "pack";

    let presetPromise: Promise<SmplrPreset>;

    if (source.kind === "machine") {
      mode = "machine";
      const pack = getDrumAbuseMachinePack(source.machine);
      if (!pack) {
        throw new Error(`DrumAbuse: unknown machine "${source.machine}"`);
      }
      packId = pack;
      machineId = source.machine;
      const url = `${packBase(baseUrl, pack)}/machines/${encodeURIComponent(source.machine)}.json`;
      presetPromise = fetchJSON<RepoMachine>(url, storage).then((machine) => {
        const built = buildMachinePreset(machine, source.set, baseUrl, pack);
        sampleNames = built.sampleNames;
        groupNames = built.groupNames;
        sampleNamesForGroup = built.sampleNamesForGroup;
        setPath = built.setPath;
        return built.preset;
      });
    } else {
      mode = "pack";
      if (!(DRUM_ABUSE_PACKS as readonly string[]).includes(source.pack)) {
        throw new Error(`DrumAbuse: unknown pack "${source.pack}"`);
      }
      packId = source.pack;
      const url = `${packBase(baseUrl, source.pack)}/instruments/${encodeURIComponent(source.instrument)}.json`;
      presetPromise = fetchJSON<RepoPackSample[]>(url, storage).then((list) => {
        const built = buildPackPreset(list, baseUrl, source.pack);
        sampleNames = built.sampleNames;
        groupNames = built.groupNames;
        sampleNamesForGroup = built.sampleNamesForGroup;
        return built.preset;
      });
    }

    const baseStart = smplr.start.bind(smplr);
    const extras: DrumAbuseExtras = {
      get mode() {
        return mode;
      },
      getSampleNames: () => sampleNames.slice(),
      getGroupNames: () => groupNames.slice(),
      getSampleNamesForGroup: (g) => (sampleNamesForGroup[g] ?? []).slice(),
      getMachineId: () => machineId,
      getSetPath: () => setPath,
      getPackId: () => packId,
      start: (event) => {
        const ev = typeof event === "object" ? event : { note: event };
        return baseStart({ ...ev, stopId: ev.stopId ?? ev.note });
      },
    };

    const ready = presetPromise.then((preset) => smplr.loadInstrument(preset));
    return { extras, ready };
  },
);

export type DrumAbuse = ReturnType<typeof DrumAbuse>;
