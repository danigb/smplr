"use client";

import { useEffect, useRef, useState } from "react";
import { CacheStorage, Reverb, Sequencer, SplendidGrandPiano } from "smplr";
import { ConnectMidi } from "./ConnectMidi";
import { PianoKeyboard } from "./PianoKeyboard";
import { getAudioContext } from "./audio-context";
import { LoadWithStatus, SampleFormat, useStatus } from "./useStatus";

let reverb: Reverb | undefined;
let storage: CacheStorage | undefined;

export function PianoExample({ className }: { className?: string }) {
  const [piano, setPiano] = useState<SplendidGrandPiano | undefined>(undefined);
  const { status, setStatus, progress, onLoadProgress } = useStatus();
  const [format, setFormat] = useState<SampleFormat>("ogg");
  const [reverbMix, setReverbMix] = useState(0.0);
  const [volume, setVolume] = useState(100);
  const seqRef = useRef<Sequencer | null>(null);
  const [seqState, setSeqState] = useState<"stopped" | "playing" | "paused">(
    "stopped",
  );

  async function toggleSequence() {
    if (!piano) return;
    const seq = seqRef.current;
    if (seq && seq.state === "playing") {
      seq.pause();
      setSeqState("paused");
      return;
    }
    if (seq && seq.state === "paused") {
      seq.start();
      setSeqState("playing");
      return;
    }
    // Create a new sequencer and load the sequence
    const notes = await fetch("/arabesque.json").then((r) => r.json());
    const newSeq = new Sequencer(piano.context, {
      bpm: 80,
      humanize: { timing: 5, velocity: 20 },
    });
    // Type mismatch on onStart/onEnded callback params — safe at runtime
    newSeq.addTrack(piano as any, notes);
    newSeq.on("end", () => setSeqState("stopped"));
    seqRef.current = newSeq;
    newSeq.start();
    setSeqState("playing");
  }

  useEffect(() => {
    return () => {
      seqRef.current?.stop();
    };
  }, []);

  function loadPiano() {
    if (piano) return;
    setStatus("loading");
    const context = getAudioContext();
    reverb ??= new Reverb(context);
    storage ??= new CacheStorage();
    const newPiano = new SplendidGrandPiano(context, {
      volume,
      storage,
      onLoadProgress,
      formats: [format],
    });
    newPiano.output.addEffect("reverb", reverb, reverbMix);
    setPiano(newPiano);
    newPiano.load.then(() => {
      setStatus("ready");
    });
  }

  return (
    <div className={className}>
      <div className="flex gap-2 items-end mb-2">
        <h1 className="text-3xl">SplendidGrandPiano</h1>
        <LoadWithStatus
          status={status}
          progress={progress}
          onClick={loadPiano}
          format={format}
          onFormatChange={status === "init" ? setFormat : undefined}
        />
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
          <button
            className="bg-zinc-700 rounded px-3 py-0.5 shadow"
            onClick={toggleSequence}
          >
            {seqState === "playing" ? "Pause sequence" : "Play sequence"}
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
