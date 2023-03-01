"use client";

import { useState } from "react";
import { ElectricPiano, Reverb } from "smplr";
import { getAudioContext } from "./audio-context";
import { ConnectMidi } from "./ConnectMidi";
import { PianoKeyboard } from "./PianoKeyboard";
import { LoadWithStatus, useStatus } from "./useStatus";

let reverb: Reverb | undefined;

export function ElectricPianoExample({ className }: { className?: string }) {
  const [piano, setPiano] = useState<ElectricPiano | undefined>(undefined);
  const [status, setStatus] = useStatus();
  const [reverbMix, setReverbMix] = useState(0);
  const [tremolo, setTremolo] = useState(0);
  const [volume, setVolume] = useState(100);

  function loadPiano() {
    if (piano) return;
    setStatus("loading");
    const context = getAudioContext();
    reverb ??= new Reverb(context);
    const newPiano = new ElectricPiano(context, "CP80", { volume });
    newPiano.output.addEffect("reverb", reverb, reverbMix);
    setPiano(newPiano);
    newPiano.loaded().then(() => {
      setStatus("ready");
    });
  }

  return (
    <div className={className}>
      <div className="flex gap-2 items-end mb-2">
        <h1 className="text-3xl">Electric Piano</h1>
        <LoadWithStatus status={status} onClick={loadPiano} />
        <ConnectMidi instrument={piano} />
      </div>
      <div></div>
      <div className={status !== "ready" ? "opacity-30" : ""}>
        <div className="flex gap-4 mb-2 no-select">
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
            max={128}
            step={1}
            value={volume}
            onChange={(e) => {
              const volume = e.target.valueAsNumber;
              piano?.output.setVolume(volume);
              setVolume(volume);
            }}
          />
          <div>Tremolo:</div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={tremolo}
            onChange={(e) => {
              const mix = e.target.valueAsNumber;
              piano?.tremolo.setMix(mix);
              setTremolo(mix);
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
              piano?.output.sendEffect("reverb", mix);
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
