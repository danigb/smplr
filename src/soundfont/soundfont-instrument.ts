import { spreadRegions } from "../player/layers";
import { AudioBuffers, findFirstSupportedFormat } from "../player/load-audio";
import { toMidi } from "../player/midi";
import { RegionGroup } from "../player/types";
import { Storage } from "../storage";

export function gleitzKitUrl(name: string, kit: string) {
  const format = findFirstSupportedFormat(["ogg", "mp3"]) ?? "mp3";
  return `https://gleitz.github.io/midi-js-soundfonts/${kit}/${name}-${format}.js`;
}

export function soundfontInstrumentLoader(
  url: string,
  buffers: AudioBuffers,
  group: RegionGroup
) {
  return async (context: BaseAudioContext, storage: Storage) => {
    const sourceFile = await (await storage.fetch(url)).text();
    const json = midiJsToJson(sourceFile);

    const noteNames = Object.keys(json);
    await Promise.all(
      noteNames.map(async (noteName) => {
        const midi = toMidi(noteName);
        if (!midi) return;
        const audioData = base64ToArrayBuffer(
          removeBase64Prefix(json[noteName])
        );
        const buffer = await context.decodeAudioData(audioData);
        buffers[noteName] = buffer;
        group.regions.push({
          sampleName: noteName,
          midiPitch: midi,
        });
      })
    );
    spreadRegions(group.regions);
  };
}

// convert a MIDI.js javascript soundfont file to json
function midiJsToJson(source: string) {
  const header = source.indexOf("MIDI.Soundfont.");
  if (header < 0) throw Error("Invalid MIDI.js Soundfont format");
  const start = source.indexOf("=", header) + 2;
  const end = source.lastIndexOf(",");
  return JSON.parse(source.slice(start, end) + "}");
}

function removeBase64Prefix(audioBase64: string) {
  return audioBase64.slice(audioBase64.indexOf(",") + 1);
}

function base64ToArrayBuffer(base64: string) {
  const decoded = window.atob(base64);
  const len = decoded.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes.buffer;
}

export const SOUNDFONT_KITS = ["MusyngKite", "FluidR3_GM"];
export const DEFAULT_SOUNDFONT_KIT = SOUNDFONT_KITS[0];

export const SOUNDFONT_INSTRUMENTS = [
  "accordion",
  "acoustic_bass",
  "acoustic_grand_piano",
  "acoustic_guitar_nylon",
  "acoustic_guitar_steel",
  "agogo",
  "alto_sax",
  "applause",
  "bagpipe",
  "banjo",
  "baritone_sax",
  "bassoon",
  "bird_tweet",
  "blown_bottle",
  "brass_section",
  "breath_noise",
  "bright_acoustic_piano",
  "celesta",
  "cello",
  "choir_aahs",
  "church_organ",
  "clarinet",
  "clavinet",
  "contrabass",
  "distortion_guitar",
  "drawbar_organ",
  "dulcimer",
  "electric_bass_finger",
  "electric_bass_pick",
  "electric_grand_piano",
  "electric_guitar_clean",
  "electric_guitar_jazz",
  "electric_guitar_muted",
  "electric_piano_1",
  "electric_piano_2",
  "english_horn",
  "fiddle",
  "flute",
  "french_horn",
  "fretless_bass",
  "fx_1_rain",
  "fx_2_soundtrack",
  "fx_3_crystal",
  "fx_4_atmosphere",
  "fx_5_brightness",
  "fx_6_goblins",
  "fx_7_echoes",
  "fx_8_scifi",
  "glockenspiel",
  "guitar_fret_noise",
  "guitar_harmonics",
  "gunshot",
  "harmonica",
  "harpsichord",
  "helicopter",
  "honkytonk_piano",
  "kalimba",
  "koto",
  "lead_1_square",
  "lead_2_sawtooth",
  "lead_3_calliope",
  "lead_4_chiff",
  "lead_5_charang",
  "lead_6_voice",
  "lead_7_fifths",
  "lead_8_bass__lead",
  "marimba",
  "melodic_tom",
  "music_box",
  "muted_trumpet",
  "oboe",
  "ocarina",
  "orchestra_hit",
  "orchestral_harp",
  "overdriven_guitar",
  "pad_1_new_age",
  "pad_2_warm",
  "pad_3_polysynth",
  "pad_4_choir",
  "pad_5_bowed",
  "pad_6_metallic",
  "pad_7_halo",
  "pad_8_sweep",
  "pan_flute",
  "percussive_organ",
  "piccolo",
  "pizzicato_strings",
  "recorder",
  "reed_organ",
  "reverse_cymbal",
  "rock_organ",
  "seashore",
  "shakuhachi",
  "shamisen",
  "shanai",
  "sitar",
  "slap_bass_1",
  "slap_bass_2",
  "soprano_sax",
  "steel_drums",
  "string_ensemble_1",
  "string_ensemble_2",
  "synth_bass_1",
  "synth_bass_2",
  "synth_brass_1",
  "synth_brass_2",
  "synth_choir",
  "synth_drum",
  "synth_strings_1",
  "synth_strings_2",
  "taiko_drum",
  "tango_accordion",
  "telephone_ring",
  "tenor_sax",
  "timpani",
  "tinkle_bell",
  "tremolo_strings",
  "trombone",
  "trumpet",
  "tuba",
  "tubular_bells",
  "vibraphone",
  "viola",
  "violin",
  "voice_oohs",
  "whistle",
  "woodblock",
  "xylophone",
];
