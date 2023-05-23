import {
  AudioBuffers,
  findFirstSupportedFormat,
  loadAudioBuffer,
} from "./sampler/load-audio";
import { toMidi } from "./sampler/midi";
import { Sampler, SamplerAudioLoader } from "./sampler/sampler";

/**
 * Splendid Grand Piano options
 */
export type SplendidGrandPianoConfig = {
  baseUrl: string;
  destination: AudioNode;

  detune: number;
  volume: number;
  velocity: number;
  decayTime?: number;
  lpfCutoffHz?: number;
};

const BASE_URL = "https://danigb.github.io/samples/splendid-grand-piano";

export class SplendidGrandPiano extends Sampler {
  constructor(
    context: AudioContext,
    options: Partial<SplendidGrandPianoConfig> = {}
  ) {
    super(context, {
      destination: options.destination,

      detune: options.detune,
      volume: options.volume,
      velocity: options.velocity,
      decayTime: options.decayTime ?? 0.5,
      lpfCutoffHz: options.lpfCutoffHz,

      buffers: splendidGrandPianoLoader(options.baseUrl ?? BASE_URL),

      noteToSample: (note, buffers, config) => {
        const midi = toMidi(note.note);
        if (!midi) return [note.note, 0];

        const vel = note.velocity ?? config.velocity;
        const layerIdx = LAYERS.findIndex(
          (layer) => vel >= layer.vel_range[0] && vel <= layer.vel_range[1]
        );
        const layer = LAYERS[layerIdx];
        if (!layer) return ["", 0];

        return findNearestMidiInLayer(layer.name, midi, buffers);
      },
    });
  }
}

function findNearestMidiInLayer(
  prefix: string,
  midi: number,
  buffers: AudioBuffers
): [string, number] {
  let i = 0;
  while (buffers[prefix + (midi + i)] === undefined && i < 128) {
    if (i > 0) i = -i;
    else i = -i + 1;
  }

  return i === 127 ? [prefix + midi, 0] : [prefix + (midi + i), -i * 100];
}

function splendidGrandPianoLoader(baseUrl: string): SamplerAudioLoader {
  const format = findFirstSupportedFormat(["ogg", "m4a"]) ?? "ogg";
  return async (context: AudioContext, buffers: AudioBuffers) => {
    for (const layer of LAYERS) {
      await Promise.all(
        layer.samples.map(async ([midi, name]) => {
          const url = `${baseUrl}/${name}.${format}`;
          const buffer = await loadAudioBuffer(context, url);
          if (buffer) buffers[layer.name + midi] = buffer;
        })
      );
    }
  };
}

export const LAYERS = [
  {
    name: "PPP",
    vel_range: [1, 40],
    cutoff: 1000,
    samples: [
      [23, "PP-B-1"],
      [27, "PP-D#0"],
      [29, "PP-F0"],
      [31, "PP-G0"],
      [33, "PP-A0"],
      [35, "PP-B0"],
      [37, "PP-C#1"],
      [38, "PP-D1"],
      [40, "PP-E1"],
      [41, "PP-F1"],
      [43, "PP-G1"],
      [45, "PP-A1"],
      [47, "PP-B1"],
      [48, "PP-C2"],
      [50, "PP-D2"],
      [52, "PP-E2"],
      [53, "PP-F2"],
      [55, "PP-G2"],
      [56, "PP-G#2"],
      [57, "PP-A2"],
      [58, "PP-A#2"],
      [59, "PP-B2"],
      [60, "PP-C3"],
      [62, "PP-D3"],
      [64, "PP-E3"],
      [65, "PP-F3"],
      [67, "PP-G3"],
      [69, "PP-A3"],
      [71, "PP-B3"],
      [72, "PP-C4"],
      [74, "PP-D4"],
      [76, "PP-E4"],
      [77, "PP-F4"],
      [79, "PP-G4"],
      [80, "PP-G#4"],
      [81, "PP-A4"],
      [82, "PP-A#4"],
      [83, "PP-B4"],
      [85, "PP-C#5"],
      [86, "PP-D5"],
      [87, "PP-D#5"],
      [89, "PP-F5"],
      [90, "PP-F#5"],
      [91, "PP-G5"],
      [92, "PP-G#5"],
      [93, "PP-A5"],
      [94, "PP-A#5"],
      [95, "PP-B5"],
      [96, "PP-C6"],
      [97, "PP-C#6"],
      [98, "PP-D6"],
      [99, "PP-D#6"],
      [100, "PP-E6"],
      [101, "PP-F6"],
      [102, "PP-F#6"],
      [103, "PP-G6"],
      [104, "PP-G#6"],
      [105, "PP-A6"],
      [106, "PP-A#6"],
      [107, "PP-B6"],
      [108, "PP-C7"],
    ],
  },
  {
    name: "PP",
    vel_range: [41, 67],
    samples: [
      [23, "PP-B-1"],
      [27, "PP-D#0"],
      [29, "PP-F0"],
      [31, "PP-G0"],
      [33, "PP-A0"],
      [35, "PP-B0"],
      [37, "PP-C#1"],
      [38, "PP-D1"],
      [40, "PP-E1"],
      [41, "PP-F1"],
      [43, "PP-G1"],
      [45, "PP-A1"],
      [47, "PP-B1"],
      [48, "PP-C2"],
      [50, "PP-D2"],
      [52, "PP-E2"],
      [53, "PP-F2"],
      [55, "PP-G2"],
      [56, "PP-G#2"],
      [57, "PP-A2"],
      [58, "PP-A#2"],
      [59, "PP-B2"],
      [60, "PP-C3"],
      [62, "PP-D3"],
      [64, "PP-E3"],
      [65, "PP-F3"],
      [67, "PP-G3"],
      [69, "PP-A3"],
      [71, "PP-B3"],
      [72, "PP-C4"],
      [74, "PP-D4"],
      [76, "PP-E4"],
      [77, "PP-F4"],
      [79, "PP-G4"],
      [80, "PP-G#4"],
      [81, "PP-A4"],
      [82, "PP-A#4"],
      [83, "PP-B4"],
      [85, "PP-C#5"],
      [86, "PP-D5"],
      [87, "PP-D#5"],
      [89, "PP-F5"],
      [90, "PP-F#5"],
      [91, "PP-G5"],
      [92, "PP-G#5"],
      [93, "PP-A5"],
      [94, "PP-A#5"],
      [95, "PP-B5"],
      [96, "PP-C6"],
      [97, "PP-C#6"],
      [98, "PP-D6"],
      [99, "PP-D#6"],
      [100, "PP-E6"],
      [101, "PP-F6"],
      [102, "PP-F#6"],
      [103, "PP-G6"],
      [104, "PP-G#6"],
      [105, "PP-A6"],
      [106, "PP-A#6"],
      [107, "PP-B6"],
      [108, "PP-C7"],
    ],
  },
  {
    name: "MP",
    vel_range: [68, 84],
    samples: [
      [23, "Mp-B-1"],
      [27, "Mp-D#0"],
      [29, "Mp-F0"],
      [31, "Mp-G0"],
      [33, "Mp-A0"],
      [35, "Mp-B0"],
      [37, "Mp-C#1"],
      [38, "Mp-D1"],
      [40, "Mp-E1"],
      [41, "Mp-F1"],
      [43, "Mp-G1"],
      [45, "Mp-A1"],
      [47, "Mp-B1"],
      [48, "Mp-C2"],
      [50, "Mp-D2"],
      [52, "Mp-E2"],
      [53, "Mp-F2"],
      [55, "Mp-G2"],
      [56, "Mp-G#2"],
      [57, "Mp-A2"],
      [58, "Mp-A#2"],
      [59, "Mp-B2"],
      [60, "Mp-C3"],
      [62, "Mp-D3"],
      [64, "Mp-E3"],
      [65, "Mp-F3"],
      [67, "Mp-G3"],
      [69, "Mp-A3"],
      [71, "Mp-B3"],
      [72, "Mp-C4"],
      [74, "Mp-D4"],
      [76, "Mp-E4"],
      [77, "Mp-F4"],
      [79, "Mp-G4"],
      [80, "Mp-G#4"],
      [81, "Mp-A4"],
      [82, "Mp-A#4"],
      [83, "Mp-B4"],
      [85, "Mp-C#5"],
      [86, "Mp-D5"],
      [87, "Mp-D#5"],
      [88, "Mp-E5"],
      [89, "Mp-F5"],
      [90, "Mp-F#5"],
      [91, "Mp-G5"],
      [92, "Mp-G#5"],
      [93, "Mp-A5"],
      [94, "Mp-A#5"],
      [95, "Mp-B5"],
      [96, "Mp-C6"],
      [97, "Mp-C#6"],
      [98, "Mp-D6"],
      [99, "Mp-D#6"],
      [100, "PP-E6"],
      [101, "Mp-F6"],
      [102, "Mp-F#6"],
      [103, "Mp-G6"],
      [104, "Mp-G#6"],
      [105, "Mp-A6"],
      [106, "Mp-A#6"],
      [107, "PP-B6"],
      [108, "PP-C7"],
    ],
  },
  {
    name: "MF",
    vel_range: [85, 100],
    samples: [
      [23, "Mf-B-1"],
      [27, "Mf-D#0"],
      [29, "Mf-F0"],
      [31, "Mf-G0"],
      [33, "Mf-A0"],
      [35, "Mf-B0"],
      [37, "Mf-C#1"],
      [38, "Mf-D1"],
      [40, "Mf-E1"],
      [41, "Mf-F1"],
      [43, "Mf-G1"],
      [45, "Mf-A1"],
      [47, "Mf-B1"],
      [48, "Mf-C2"],
      [50, "Mf-D2"],
      [52, "Mf-E2"],
      [53, "Mf-F2"],
      [55, "Mf-G2"],
      [56, "Mf-G#2"],
      [57, "Mf-A2"],
      [58, "Mf-A#2"],
      [59, "Mf-B2"],
      [60, "Mf-C3"],
      [62, "Mf-D3"],
      [64, "Mf-E3"],
      [65, "Mf-F3"],
      [67, "Mf-G3"],
      [69, "Mf-A3"],
      [71, "Mf-B3"],
      [72, "Mf-C4"],
      [74, "Mf-D4"],
      [76, "Mf-E4"],
      [77, "Mf-F4"],
      [79, "Mf-G4"],
      [80, "Mf-G#4"],
      [81, "Mf-A4"],
      [82, "Mf-A#4"],
      [83, "Mf-B4"],
      [85, "Mf-C#5"],
      [86, "Mf-D5"],
      [87, "Mf-D#5"],
      [88, "Mf-E5"],
      [89, "Mf-F5"],
      [90, "Mf-F#5"],
      [91, "Mf-G5"],
      [92, "Mf-G#5"],
      [93, "Mf-A5"],
      [94, "Mf-A#5"],
      [95, "Mf-B5"],
      [96, "Mf-C6"],
      [97, "Mf-C#6"],
      [98, "Mf-D6"],
      [99, "Mf-D#6"],
      [100, "Mf-E6"],
      [101, "Mf-F6"],
      [102, "Mf-F#6"],
      [103, "Mf-G6"],
      [104, "Mf-G#6"],
      [105, "Mf-A6"],
      [106, "Mf-A#6"],
      [107, "Mf-B6"],
      [108, "PP-C7"],
    ],
  },
  {
    name: "FF",
    vel_range: [101, 127],
    samples: [
      [23, "FF-B-1"],
      [27, "FF-D#0"],
      [29, "FF-F0"],
      [31, "FF-G0"],
      [33, "FF-A0"],
      [35, "FF-B0"],
      [37, "FF-C#1"],
      [38, "FF-D1"],
      [40, "FF-E1"],
      [41, "FF-F1"],
      [43, "FF-G1"],
      [45, "FF-A1"],
      [47, "FF-B1"],
      [48, "FF-C2"],
      [50, "FF-D2"],
      [52, "FF-E2"],
      [53, "FF-F2"],
      [55, "FF-G2"],
      [56, "FF-G#2"],
      [57, "FF-A2"],
      [58, "FF-A#2"],
      [59, "FF-B2"],
      [60, "FF-C3"],
      [62, "FF-D3"],
      [64, "FF-E3"],
      [65, "FF-F3"],
      [67, "FF-G3"],
      [69, "FF-A3"],
      [71, "FF-B3"],
      [72, "FF-C4"],
      [74, "FF-D4"],
      [76, "FF-E4"],
      [77, "FF-F4"],
      [79, "FF-G4"],
      [80, "FF-G#4"],
      [81, "FF-A4"],
      [82, "FF-A#4"],
      [83, "FF-B4"],
      [85, "FF-C#5"],
      [86, "FF-D5"],
      [88, "FF-E5"],
      [89, "FF-F5"],
      [91, "FF-G5"],
      [93, "FF-A5"],
      [95, "Mf-B5"],
      [96, "Mf-C6"],
      [97, "Mf-C#6"],
      [98, "Mf-D6"],
      [99, "Mf-D#6"],
      [100, "Mf-E6"],
      [102, "Mf-F#6"],
      [103, "Mf-G6"],
      [104, "Mf-G#6"],
      [105, "Mf-A6"],
      [106, "Mf-A#6"],
      [107, "Mf-B6"],
      [108, "Mf-C7"],
    ],
  },
];
