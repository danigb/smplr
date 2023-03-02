"use client";

import { useState } from "react";
import { getVersilianNames, Reverb, Versilian } from "smplr";
import { getAudioContext } from "./audio-context";
import { ConnectMidi } from "./ConnectMidi";
import { PianoKeyboard } from "./PianoKeyboard";
import { LoadWithStatus, useStatus } from "./useStatus";

let reverb: Reverb | undefined;
let instrumentNames = getVersilianNames();

export function VersilianExample({ className }: { className?: string }) {
  const [instrument, setInstrument] = useState<Versilian | undefined>(
    undefined
  );
  const [instrumentName, setInstrumentName] = useState("CP80");
  const [status, setStatus] = useStatus();
  const [reverbMix, setReverbMix] = useState(0);
  const [volume, setVolume] = useState(100);

  function loadVersilian(instrumentName: string) {
    if (instrument) instrument.disconnect();
    setStatus("loading");
    const context = getAudioContext();
    reverb ??= new Reverb(context);
    const newPiano = new Versilian(context, {
      instrument: instrumentName,
      volume,
    });
    newPiano.output.addEffect("reverb", reverb, reverbMix);
    setInstrument(newPiano);
    newPiano.loaded().then(() => {
      setStatus("ready");
    });
  }

  return (
    <div className={className}>
      <div className="flex gap-2 items-end mb-2">
        <h1 className="text-3xl">Versilian Community</h1>
        <LoadWithStatus
          status={status}
          onClick={() => loadVersilian(instrumentName)}
        />
        <ConnectMidi instrument={instrument} />
      </div>
      <div></div>
      <div className={status !== "ready" ? "opacity-30" : ""}>
        <div className="flex gap-4 mb-2 no-select">
          <select
            className="bg-zinc-700 rounded"
            value={instrumentName}
            onChange={(e) => {
              const instrumentName = e.target.value;
              loadVersilian(instrumentName);
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
