"use client";

import { useState } from "react";
import { Mellotron, Reverb, getMellotronNames } from "smplr";
import { ConnectMidi } from "./ConnectMidi";
import { PianoKeyboard } from "./PianoKeyboard";
import { getAudioContext } from "./audio-context";
import { LoadWithStatus, useStatus } from "./useStatus";

let reverb: Reverb | undefined;
let instrumentNames = getMellotronNames();

export function MellotronExample({ className }: { className?: string }) {
  const [instrument, setInstrument] = useState<Mellotron | undefined>(
    undefined
  );
  const [instrumentName, setInstrumentName] = useState<string>(
    instrumentNames[0]
  );
  const [status, setStatus] = useStatus();
  const [reverbMix, setReverbMix] = useState(0);
  const [volume, setVolume] = useState(100);

  function loadMellotron(instrumentName: string) {
    if (instrument) instrument.disconnect();
    setStatus("loading");
    const context = getAudioContext();
    reverb ??= new Reverb(context);
    const newInstrument = new Mellotron(context, {
      instrument: instrumentName,
      volume,
    });
    newInstrument.output.addEffect("reverb", reverb, reverbMix);
    setInstrument(newInstrument);
    newInstrument.load.then(() => {
      setStatus("ready");
    });
  }

  return (
    <div className={className}>
      <div className="flex gap-2 items-end mb-2">
        <h1 className="text-3xl">Mellotron</h1>

        <LoadWithStatus
          status={status}
          onClick={() => loadMellotron(instrumentName)}
        />
        <ConnectMidi instrument={instrument} />
      </div>
      <div></div>
      <div className={status !== "ready" ? "opacity-30" : ""}>
        <div className="flex gap-4 mb-2 no-select">
          <select
            className="appearance-none bg-zinc-700 text-zinc-200 rounded border border-gray-400 py-2 px-3 leading-tight focus:outline-none focus:border-blue-500"
            value={instrumentName}
            onChange={(e) => {
              const instrumentName = e.target.value;
              loadMellotron(instrumentName);
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
              instrument?.stop();
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
              instrument?.output.setVolume(volume);
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
              instrument?.output.sendEffect("reverb", mix);
              setReverbMix(mix);
            }}
          />
        </div>
        <PianoKeyboard
          borderColor="border-rose-700"
          onPress={(note) => {
            if (!instrument) return;
            note.time = (note.time ?? 0) + instrument.context.currentTime;
            instrument.start(note);
          }}
          onRelease={(midi) => {
            instrument?.stop({ stopId: midi });
          }}
        />
      </div>
    </div>
  );
}
