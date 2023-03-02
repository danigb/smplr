import { SfzSampler, SfzSamplerConfig } from "./sfz-sampler";
import { SfzInstrument } from "./sfz/sfz-kits";

export function getVersilianNames() {
  return Object.keys(DATA);
}

export class Versilian extends SfzSampler {
  constructor(
    context: AudioContext,
    options: Partial<SfzSamplerConfig> & { instrument: string }
  ) {
    const instrument = getVersilian(options.instrument);
    super(context, {
      ...options,
      instrument,
    });
  }
}

export function getVersilian(name: VersilianName | string): SfzInstrument {
  if (!DATA[name]) throw Error(`Versilian instrument "${name}" not valid`);
  return {
    name: name,
    websfzUrl: BASE_URL + DATA[name] + EXT,
  };
}
const BASE_URL = "https://danigb.github.io/samples/vcsl/";
const EXT = ".websfz.json";

type VersilianName = keyof typeof DATA;

export const DATA = {
  "Agogo Bells": "Struck Idiophones/agogo-bells",
  Anvil: "Struck Idiophones/anvil",
  "Balafon - Hard Mallet": "Struck Idiophones/balafon-hard-mallet",
  "Balafon - Keyswitch": "Struck Idiophones/balafon-keyswitch",
  "Balafon - Soft Mallet": "Struck Idiophones/balafon-soft-mallet",
  "Balafon - Traditional Mallet":
    "Struck Idiophones/balafon-traditional-mallet",
  "Ball Whistle": "Edge-blown Aerophones/ball-whistle",
  "Baroque Alto Recorder - Keyswitch":
    "Edge-blown Aerophones/baroque-alto-recorder-keyswitch",
  "Baroque Alto Recorder - Staccato":
    "Edge-blown Aerophones/baroque-alto-recorder-staccato",
  "Baroque Alto Recorder - Sustain":
    "Edge-blown Aerophones/baroque-alto-recorder-sustain",
  "Baroque Alto Recorder - SusVib":
    "Edge-blown Aerophones/baroque-alto-recorder-susvib",
  "Baroque Bass Recorder - Keyswitch":
    "Edge-blown Aerophones/baroque-bass-recorder-keyswitch",
  "Baroque Bass Recorder - Staccato":
    "Edge-blown Aerophones/baroque-bass-recorder-staccato",
  "Baroque Bass Recorder - Sustain":
    "Edge-blown Aerophones/baroque-bass-recorder-sustain",
  "Baroque Bass Recorder - SusVib":
    "Edge-blown Aerophones/baroque-bass-recorder-susvib",
  "Baroque Soprano Recorder - Keyswitch":
    "Edge-blown Aerophones/baroque-soprano-recorder-keyswitch",
  "Baroque Soprano Recorder - Staccato":
    "Edge-blown Aerophones/baroque-soprano-recorder-staccato",
  "Baroque Soprano Recorder - Sustain":
    "Edge-blown Aerophones/baroque-soprano-recorder-sustain",
  "Baroque Tenor Recorder - Keyswitch":
    "Edge-blown Aerophones/baroque-tenor-recorder-keyswitch",
  "Baroque Tenor Recorder - Staccato":
    "Edge-blown Aerophones/baroque-tenor-recorder-staccato",
  "Baroque Tenor Recorder - Sustain":
    "Edge-blown Aerophones/baroque-tenor-recorder-sustain",
  "Baroque Tenor Recorder - SusVib":
    "Edge-blown Aerophones/baroque-tenor-recorder-susvib",
  "Bass Drum 1": "Struck Membranophones/bass-drum-1",
  "Bass Drum 2": "Struck Membranophones/bass-drum-2",
  "Bass Drum 3 - Legacy": "Struck Membranophones/bass-drum-3-legacy",
  "Bell Tree - Individual": "Struck Idiophones/bell-tree-individual",
  "Bell Tree - Keyswitch": "Struck Idiophones/bell-tree-keyswitch",
  "Bell Tree - Legacy": "Struck Idiophones/bell-tree-legacy",
  "Bell Tree - Stroke": "Struck Idiophones/bell-tree-stroke",
  Bongos: "Struck Membranophones/bongos",
  "Brake Drum": "Struck Idiophones/brake-drum",
  Cabasa: "Struck Idiophones/cabasa",
  Cajon: "Struck Idiophones/cajon",
  Claps: "Struck Idiophones/claps",
  "Clash Cymbals 1": "Struck Idiophones/clash-cymbals-1",
  "Clash Cymbals 2": "Struck Idiophones/clash-cymbals-2",
  Claves: "Struck Idiophones/claves",
  "Concert Harp": "Composite Chordophones/concert-harp",
  Conga: "Struck Membranophones/conga",
  Cowbells: "Struck Idiophones/cowbells",
  "Dan Tranh - FX": "Zithers/dan-tranh-fx",
  "Dan Tranh - Gliss": "Zithers/dan-tranh-gliss",
  "Dan Tranh - Keyswitch": "Zithers/dan-tranh-keyswitch",
  "Dan Tranh - Normal": "Zithers/dan-tranh-normal",
  "Dan Tranh - Tremolo": "Zithers/dan-tranh-tremolo",
  "Dan Tranh - Vibrato": "Zithers/dan-tranh-vibrato",
  Darbuka: "Struck Membranophones/darbuka",
  Didgeridoo: "Lip Aerophones/didgeridoo",
  "Finger Cymbals": "Struck Idiophones/finger-cymbals",
  Flexatone: "Struck Idiophones/flexatone",
  "Folk Harp": "Composite Chordophones/folk-harp",
  "Frame Drum": "Struck Membranophones/frame-drum",
  Glockenspiel: "Struck Idiophones/glockenspiel",
  "Gong 1": "Struck Idiophones/gong-1",
  "Gong 2": "Struck Idiophones/gong-2",
  "Grand Piano, Kawai": "Zithers/grand-piano-kawai",
  "Grand Piano, Kawai - Legacy": "Zithers/grand-piano-kawai-legacy",
  "Grand Piano, Steinway B": "Zithers/grand-piano-steinway-b",
  Guiro: "Struck Idiophones/guiro",
  "Guiro - Keyswitch": "Struck Idiophones/guiro-keyswitch",
  "Guiro - Legacy": "Struck Idiophones/guiro-legacy",
  "Hand Bells, Nepalese": "Struck Idiophones/hand-bells-nepalese",
  "Hand Chimes": "Struck Idiophones/hand-chimes",
  "Harmonica-Hohner-Special20-C - Keyswitch":
    "Free Aerophones/harmonicahohnerspecial20c-keyswitch",
  "Harmonica-Hohner-Special20-C - Normal":
    "Free Aerophones/harmonicahohnerspecial20c-normal",
  "Harmonica-Hohner-Special20-C - Soft":
    "Free Aerophones/harmonicahohnerspecial20c-soft",
  "Harmonica-Hohner-Special20-C - Vib":
    "Free Aerophones/harmonicahohnerspecial20c-vib",
  "Harmonica-Hohner-Special20-F - Accented":
    "Free Aerophones/harmonicahohnerspecial20f-accented",
  "Harmonica-Hohner-Special20-F - HandVib":
    "Free Aerophones/harmonicahohnerspecial20f-handvib",
  "Harmonica-Hohner-Special20-F - Keyswitch":
    "Free Aerophones/harmonicahohnerspecial20f-keyswitch",
  "Harmonica-Hohner-Special20-F - Normal":
    "Free Aerophones/harmonicahohnerspecial20f-normal",
  "Harmonica-Hohner-Special20-F - Stac":
    "Free Aerophones/harmonicahohnerspecial20f-stac",
  "Harmonica-Hohner-Special20-F - Vib":
    "Free Aerophones/harmonicahohnerspecial20f-vib",
  "Harmonica-Hohner-Super64 - Accented":
    "Free Aerophones/harmonicahohnersuper64-accented",
  "Harmonica-Hohner-Super64 - Keyswitch":
    "Free Aerophones/harmonicahohnersuper64-keyswitch",
  "Harmonica-Hohner-Super64 - Normal":
    "Free Aerophones/harmonicahohnersuper64-normal",
  "Harmonica-Hohner-Super64 - Vib":
    "Free Aerophones/harmonicahohnersuper64-vib",
  "Harpsichord, English - Keyswitch": "Zithers/harpsichord-english-keyswitch",
  "Harpsichord, English - Lute": "Zithers/harpsichord-english-lute",
  "Harpsichord, English - Normal": "Zithers/harpsichord-english-normal",
  "Harpsichord, Flemish - 4'": "Zithers/harpsichord-flemish-4",
  "Harpsichord, Flemish - 8'": "Zithers/harpsichord-flemish-8",
  "Harpsichord, Flemish - Full": "Zithers/harpsichord-flemish-full",
  "Harpsichord, Flemish - Keyswitch": "Zithers/harpsichord-flemish-keyswitch",
  "Harpsichord, French": "Zithers/harpsichord-french",
  "Harpsichord, Italian": "Zithers/harpsichord-italian",
  "Harpsichord, Unk": "Zithers/harpsichord-unk",
  "Hi-Hat Cymbal": "Struck Idiophones/hihat-cymbal",
  "Kalimba, Kenya": "Plucked Idiophones/kalimba-kenya",
  "Kalimba, Tanzania": "Plucked Idiophones/kalimba-tanzania",
  "Legacy Snares - drum1": "Struck Membranophones/legacy-snares-drum1",
  "Legacy Snares - drum2": "Struck Membranophones/legacy-snares-drum2",
  "Legacy Snares - drum3_marching":
    "Struck Membranophones/legacy-snares-drum3marching",
  "Legacy Snares - Keyswitch": "Struck Membranophones/legacy-snares-keyswitch",
  "Legacy Snares - OldSnare": "Struck Membranophones/legacy-snares-oldsnare",
  "Legacy Toms": "Struck Membranophones/legacy-toms",
  Marimba: "Struck Idiophones/marimba",
  "Mark Trees": "Struck Idiophones/mark-trees",
  "Mbira dzaVadzimu Nyamaropa, Zimbabwe, Low B":
    "Plucked Idiophones/mbira-dzavadzimu-nyamaropa-zimbabwe-low-b",
  "Mbira Mavembe (Gandanga), Zimbabwe, Low G":
    "Plucked Idiophones/mbira-mavembe-gandanga-zimbabwe-low-g",
  "Nyunga Nyunga, Mozambique, Low F":
    "Plucked Idiophones/nyunga-nyunga-mozambique-low-f",
  "Ocarina, Small - Keyswitch": "Edge-blown Aerophones/ocarina-small-keyswitch",
  "Ocarina, Small - Staccato": "Edge-blown Aerophones/ocarina-small-staccato",
  "Ocarina, Small - Sustain": "Edge-blown Aerophones/ocarina-small-sustain",
  "Ocarina, Typical - Keyswitch":
    "Edge-blown Aerophones/ocarina-typical-keyswitch",
  "Ocarina, Typical - Sus": "Edge-blown Aerophones/ocarina-typical-sus",
  "Ocarina, Typical - SusVib": "Edge-blown Aerophones/ocarina-typical-susvib",
  "Ocean Drum": "Other Membranophones/ocean-drum",
  "Pipe Organ - Keyswitch": "Edge-blown Aerophones/pipe-organ-keyswitch",
  "Pipe Organ - Loud": "Edge-blown Aerophones/pipe-organ-loud",
  "Pipe Organ - Loud Pedal": "Edge-blown Aerophones/pipe-organ-loud-pedal",
  "Pipe Organ - Quiet": "Edge-blown Aerophones/pipe-organ-quiet",
  "Pipe Organ - Quiet Pedal": "Edge-blown Aerophones/pipe-organ-quiet-pedal",
  "Psaltery, Bowed and Plucked - Keyswitch":
    "Zithers/psaltery-bowed-and-plucked-keyswitch",
  "Psaltery, Bowed and Plucked - LongBow":
    "Zithers/psaltery-bowed-and-plucked-longbow",
  "Psaltery, Bowed and Plucked - Pluck":
    "Zithers/psaltery-bowed-and-plucked-pluck",
  "Psaltery, Bowed and Plucked - Spiccato":
    "Zithers/psaltery-bowed-and-plucked-spiccato",
  Ratchet: "Struck Idiophones/ratchet",
  "Renaissance Organ - 4'": "Edge-blown Aerophones/renaissance-organ-4",
  "Renaissance Organ - 4'+8'": "Edge-blown Aerophones/renaissance-organ-48",
  "Renaissance Organ - 8'": "Edge-blown Aerophones/renaissance-organ-8",
  "Renaissance Organ - Full": "Edge-blown Aerophones/renaissance-organ-full",
  "Renaissance Organ - Keyswitch":
    "Edge-blown Aerophones/renaissance-organ-keyswitch",
  "Saxello - Keyswitch": "Reed Aerophones/saxello-keyswitch",
  "Saxello - Non-Vibrato": "Reed Aerophones/saxello-nonvibrato",
  "Saxello - Staccato": "Reed Aerophones/saxello-staccato",
  "Saxello - Vibrato": "Reed Aerophones/saxello-vibrato",
  "Shaker - Legacy": "Struck Idiophones/shaker-legacy",
  "Shaker, Large": "Struck Idiophones/shaker-large",
  "Shaker, Small": "Struck Idiophones/shaker-small",
  Siren: "Free Aerophones/siren",
  Slapstick: "Struck Idiophones/slapstick",
  "Sleigh Bells": "Struck Idiophones/sleigh-bells",
  "Slit Drum": "Struck Idiophones/slit-drum",
  "Snare Drum, Modern 1": "Struck Membranophones/snare-drum-modern-1",
  "Snare Drum, Modern 2": "Struck Membranophones/snare-drum-modern-2",
  "Snare Drum, Modern 3": "Struck Membranophones/snare-drum-modern-3",
  "Snare Drum, Rope Tension": "Struck Membranophones/snare-drum-rope-tension",
  Strumstick: "Composite Chordophones/strumstick",
  "Suspended Cymbal 1": "Struck Idiophones/suspended-cymbal-1",
  "Suspended Cymbal 2": "Struck Idiophones/suspended-cymbal-2",
  "Tambourine 1": "Struck Idiophones/tambourine-1",
  "Tambourine 2": "Struck Idiophones/tambourine-2",
  "Tambourine 3 - Legacy": "Struck Idiophones/tambourine-3-legacy",
  "Tambourine 4 - Legacy": "Struck Idiophones/tambourine-4-legacy",
  "Tambourine 5 - Legacy": "Struck Idiophones/tambourine-5-legacy",
  "Tenor Saxophone - Keyswitch": "Reed Aerophones/tenor-saxophone-keyswitch",
  "Tenor Saxophone - Non-Vibrato": "Reed Aerophones/tenor-saxophone-nonvibrato",
  "Tenor Saxophone - Staccato": "Reed Aerophones/tenor-saxophone-staccato",
  "Tenor Saxophone - Vibrato": "Reed Aerophones/tenor-saxophone-vibrato",
  "Timpani 1 - Hit": "Struck Membranophones/timpani-1-hit",
  "Timpani 1 - Keyswitch": "Struck Membranophones/timpani-1-keyswitch",
  "Timpani 1 - Roll": "Struck Membranophones/timpani-1-roll",
  "Timpani 2 - All Samples": "Struck Membranophones/timpani-2-all-samples",
  "Timpani 2 - Keyswitch": "Struck Membranophones/timpani-2-keyswitch",
  "Timpani 2 - Scale": "Struck Membranophones/timpani-2-scale",
  "Tom 1": "Struck Membranophones/tom-1",
  "Tom 2": "Struck Membranophones/tom-2",
  "Train Whistle, Toy": "Edge-blown Aerophones/train-whistle-toy",
  Triangles: "Struck Idiophones/triangles",
  "Tubular Bells 1": "Struck Idiophones/tubular-bells-1",
  "Tubular Bells 2": "Struck Idiophones/tubular-bells-2",
  "Tubular Bells 3 - Legacy": "Struck Idiophones/tubular-bells-3-legacy",
  "Tubular Glockenspiel": "Struck Idiophones/tubular-glockenspiel",
  "TX81Z - Clavisynth": "TX81Z/tx81z-clavisynth",
  "TX81Z - FM Piano": "TX81Z/tx81z-fm-piano",
  "TX81Z - Keyswitch": "TX81Z/tx81z-keyswitch",
  "TX81Z - Piano 1": "TX81Z/tx81z-piano-1",
  "Upright Piano, Knight": "Zithers/upright-piano-knight",
  "Upright Piano, Yamaha": "Zithers/upright-piano-yamaha",
  "Vibraphone - Bowed": "Struck Idiophones/vibraphone-bowed",
  "Vibraphone - Hard Mallets": "Struck Idiophones/vibraphone-hard-mallets",
  "Vibraphone - Keyswitch": "Struck Idiophones/vibraphone-keyswitch",
  "Vibraphone - Soft Mallets": "Struck Idiophones/vibraphone-soft-mallets",
  Vibraslap: "Struck Idiophones/vibraslap",
  "Wine Glasses - Fast": "Friction Idiophones/wine-glasses-fast",
  "Wine Glasses - Keyswitch": "Friction Idiophones/wine-glasses-keyswitch",
  "Wine Glasses - Slow": "Friction Idiophones/wine-glasses-slow",
  Woodblock: "Struck Idiophones/woodblock",
  "Xylophone - Hard Mallets": "Struck Idiophones/xylophone-hard-mallets",
  "Xylophone - Keyswitch": "Struck Idiophones/xylophone-keyswitch",
  "Xylophone - Medium Mallets": "Struck Idiophones/xylophone-medium-mallets",
  "Xylophone - Soft Mallets": "Struck Idiophones/xylophone-soft-mallets",
} as const;
