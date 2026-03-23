"use client";

import { useState } from "react";
import { ElectricPiano, getElectricPianoNames, Reverb, Smplr } from "smplr";

type ElectricPianoSmplr = Smplr & {
  readonly tremolo: Readonly<{ level: (value: number) => void }>;
};
import { getAudioContext } from "./audio-context";
import { ConnectMidi } from "./ConnectMidi";
import { PianoKeyboard } from "./PianoKeyboard";
import { LoadWithStatus, SampleFormat, useStatus } from "./useStatus";

let reverb: Reverb | undefined;
let instrumentNames = getElectricPianoNames();

export function ElectricPianoExample({ className }: { className?: string }) {
  const [piano, setPiano] = useState<ElectricPianoSmplr | undefined>(undefined);
  const [instrumentName, setInstrumentName] = useState("CP80");
  const { status, setStatus, progress, onLoadProgress } = useStatus();
  const [format, setFormat] = useState<SampleFormat>("ogg");
  const [reverbMix, setReverbMix] = useState(0);
  const [tremolo, setTremolo] = useState(0);
  const [volume, setVolume] = useState(100);

  function loadPiano(instrument: string) {
    if (piano) piano.disconnect();
    setStatus("loading");
    const context = getAudioContext();
    reverb ??= new Reverb(context);
    const newPiano = ElectricPiano(context, { instrument, volume, onLoadProgress, formats: [format] });
    newPiano.output.addEffect("reverb", reverb, reverbMix);
    setPiano(newPiano);
    newPiano.ready.then(() => {
      setStatus("ready");
    });
  }

  return (
    <div className={className}>
      <div className="flex gap-2 items-end mb-2">
        <h1 className="text-3xl">Electric Piano</h1>
        <LoadWithStatus
          status={status}
          progress={progress}
          onClick={() => loadPiano(instrumentName)}
          format={format}
          onFormatChange={setFormat}
        />
        <ConnectMidi instrument={piano} />
      </div>
      <div></div>
      <div className={status !== "ready" ? "opacity-30" : ""}>
        <div className="flex gap-4 mb-2 no-select">
          <select
            className="appearance-none bg-zinc-700 text-zinc-200 rounded border border-gray-400 py-2 px-3 leading-tight focus:outline-none focus:border-blue-500"
            value={instrumentName}
            onChange={(e) => {
              const instrumentName = e.target.value;
              loadPiano(instrumentName);
              setInstrumentName(instrumentName);
            }}
          >
            {instrumentNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            className="bg-zinc-700 rounded px-3 py-0.5 shadow"
            onClick={() => {
              piano?.stop();
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
              if (piano) piano.output.volume = volume;
              setVolume(volume);
            }}
          />
          <div>Tremolo:</div>
          <input
            type="range"
            min={0}
            max={127}
            step={1}
            value={tremolo}
            onChange={(e) => {
              const level = e.target.valueAsNumber;
              piano?.tremolo.level(level);
              setTremolo(level);
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
              piano?.output.setEffectMix("reverb", mix);
              setReverbMix(mix);
            }}
          />
        </div>
        <PianoKeyboard
          borderColor="border-rose-700"
          onPress={(note) => {
            if (!piano) return;
            note.time = (note.time ?? 0) + piano.context.currentTime;
            piano.start(note);
          }}
          onRelease={(midi) => {
            piano?.stop({ stopId: midi });
          }}
        />
      </div>
    </div>
  );
}
