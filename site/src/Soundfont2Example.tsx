"use client";

import { useState } from "react";
import { Reverb, Soundfont2Sampler, Storage } from "smplr";
import { SoundFont2 } from "soundfont2";
import { ConnectMidi } from "./ConnectMidi";
import { PianoKeyboard } from "./PianoKeyboard";
import { getAudioContext } from "./audio-context";
import { LoadWithStatus, useStatus } from "./useStatus";

const SF2_INSTRUMENTS: Record<string, string> = {
  "Galaxy Electric Pianos":
    "https://smpldsnds.github.io/soundfonts/soundfonts/galaxy-electric-pianos.sf2",
  "Giga MIDI":
    "https://smpldsnds.github.io/soundfonts/soundfonts/giga-hq-fm-gm.sf2",
  Supersaw:
    "https://smpldsnds.github.io/soundfonts/soundfonts/supersaw-collection.sf2",
};
const SF_NAMES = Object.keys(SF2_INSTRUMENTS);

let reverb: Reverb | undefined;
let storage: Storage | undefined;
let samplerNames: string[] = [
  "Supersaw",
  "Giga MIDI",
  "Galaxy Electric Pianos",
];

export function Soundfont2Example({ className }: { className?: string }) {
  const [sampler, setSampler] = useState<Soundfont2Sampler | undefined>(
    undefined
  );
  const [samplerName, setSamplerName] = useState<string>(samplerNames[0]);
  const [instrumentName, setInstrumentName] = useState<string>("");
  const [status, setStatus] = useStatus();
  const [reverbMix, setReverbMix] = useState(0);
  const [volume, setVolume] = useState(100);

  function loadSampler(sf2Name: string) {
    if (sampler) sampler.disconnect();
    setStatus("loading");
    const context = getAudioContext();
    setSamplerName(sf2Name);

    reverb ??= new Reverb(context);
    const newSampler = new Soundfont2Sampler(context, {
      url: SF2_INSTRUMENTS[sf2Name],
      createSoundfont: (data) => new SoundFont2(data),
    });
    newSampler.output.addEffect("reverb", reverb, reverbMix);
    setSampler(newSampler);

    newSampler.load.then((sampler) => {
      const instrumentName = sampler.instrumentNames[0];
      setInstrumentName(instrumentName);
      sampler.loadInstrument(instrumentName);
      setStatus("ready");
    });
  }

  return (
    <div className={className}>
      <div className="flex gap-2 items-end mb-2">
        <div className="flex flex-col">
          <h1 className="text-3xl">Soundfont2</h1>
          <h2>Soundfont2 sampler</h2>
        </div>

        <div>(experimental)</div>

        <LoadWithStatus
          status={status}
          onClick={() => loadSampler("Supersaw")}
        />
        <ConnectMidi instrument={sampler} />
      </div>
      <div className="my-2">
        <select
          className="appearance-none bg-zinc-700 text-zinc-200 rounded border border-gray-400 py-2 px-3 leading-tight focus:outline-none focus:border-blue-500"
          value={samplerName}
          onChange={(e) => {
            const sf2name = e.target.value;
            loadSampler(sf2name);
          }}
        >
          {samplerNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className={status !== "ready" ? "opacity-30" : ""}>
        <div className="flex gap-4 mb-2 no-select">
          <select
            className="appearance-none bg-zinc-700 text-zinc-200 rounded border border-gray-400 py-2 px-3 leading-tight focus:outline-none focus:border-blue-500"
            value={instrumentName}
            onChange={(e) => {
              const instrumentName = e.target.value;
              setInstrumentName(instrumentName);
              sampler?.loadInstrument(instrumentName);
            }}
          >
            {sampler?.instrumentNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            className="bg-zinc-700 rounded px-3 py-0.5 shadow"
            onClick={() => {
              sampler?.stop();
            }}
          >
            Stop all
          </button>
        </div>
        <div className="flex gap-4 mb-2 no-select">
          <div>Volume:</div>
          <input
            type="range"
            min={0}
            max={127}
            step={1}
            value={volume}
            onChange={(e) => {
              const volume = e.target.valueAsNumber;
              sampler?.output.setVolume(volume);
              setVolume(volume);
            }}
          />
          <div>Reverb:</div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={reverbMix}
            onChange={(e) => {
              const mix = e.target.valueAsNumber;
              sampler?.output.sendEffect("reverb", mix);
              setReverbMix(mix);
            }}
          />
        </div>
        <PianoKeyboard
          borderColor="border-blue-700"
          onPress={(note) => {
            if (!sampler) return;
            note.time = (note.time ?? 0) + sampler.context.currentTime;
            sampler.start(note);
          }}
          onRelease={(midi) => {
            sampler?.stop({ stopId: midi });
          }}
        />
      </div>
    </div>
  );
}
