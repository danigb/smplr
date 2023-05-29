"use client";

import { useState } from "react";
import { CacheStorage, Reverb, SplendidGrandPiano } from "smplr";
import { ConnectMidi } from "./ConnectMidi";
import { PianoKeyboard } from "./PianoKeyboard";
import { getAudioContext } from "./audio-context";
import { LoadWithStatus, useStatus } from "./useStatus";

let reverb: Reverb | undefined;

const storage = new CacheStorage();

export function PianoExample({ className }: { className?: string }) {
  const [piano, setPiano] = useState<SplendidGrandPiano | undefined>(undefined);
  const [status, setStatus] = useStatus();
  const [reverbMix, setReverbMix] = useState(0.0);
  const [volume, setVolume] = useState(100);

  function loadPiano() {
    if (piano) return;
    setStatus("loading");
    const context = getAudioContext();
    reverb ??= new Reverb(context);
    const newPiano = new SplendidGrandPiano(context, { volume, storage });
    newPiano.output.addEffect("reverb", reverb, reverbMix);
    setPiano(newPiano);
    newPiano.loaded().then(() => {
      setStatus("ready");
    });
  }

  return (
    <div className={className}>
      <div className="flex gap-2 items-end mb-2">
        <h1 className="text-3xl">Piano</h1>
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
