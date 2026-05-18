import { useEffect, useRef, useState } from "react";
import {
  CacheStorage,
  DrumMachine,
  Sequencer,
  SequencerNote,
  SplendidGrandPiano,
} from "smplr";
import { getAudioContext } from "src/audio-context";
import { LoadWithStatus, useStatus } from "src/useStatus";

let pianoStorage: CacheStorage | undefined;

export function MultiInstrumentSection() {
  const { status, setStatus, progress, onLoadProgress } = useStatus();

  const drumsRef = useRef<DrumMachine | null>(null);
  const pianoRef = useRef<SplendidGrandPiano | null>(null);
  const seqRef = useRef<Sequencer | null>(null);

  const [drumsPan, setDrumsPan] = useState(0);
  const [pianoPan, setPianoPan] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  function load() {
    setStatus("loading");
    const context = getAudioContext();
    pianoStorage ??= CacheStorage();
    const drums = DrumMachine(context, {
      instrument: "TR-808",
      onLoadProgress,
    });
    const piano = SplendidGrandPiano(context, {
      storage: pianoStorage,
      formats: ["ogg"],
    });

    Promise.all([drums.load, piano.load])
      .then(() => {
        drumsRef.current = drums;
        pianoRef.current = piano;
        buildSequencer();
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  function buildSequencer() {
    const drums = drumsRef.current;
    const piano = pianoRef.current;
    if (!drums || !piano) return;

    const groups = drums.getGroupNames();
    const kick = groups.find((g) => /kick|bd/i.test(g)) ?? groups[0];
    const snare = groups.find((g) => /snare|sd/i.test(g)) ?? groups[1] ?? kick;
    const hat = groups.find((g) => /hat|hh/i.test(g)) ?? groups[2] ?? kick;

    const context = drums.context;
    const seq = Sequencer(context, { bpm: 100, loop: true, loopEnd: "2m" });

    // Drums: kick on 1+3, snare on 2+4, hi-hats on every 8th
    const drumNotes: SequencerNote[] = [];
    for (let bar = 0; bar < 2; bar++) {
      const offset = bar * 1920; // 1 bar = 1920 ticks in 4/4 @ 480 PPQ
      drumNotes.push({ note: kick, at: offset + 0 });
      drumNotes.push({ note: snare, at: offset + 480 });
      drumNotes.push({ note: kick, at: offset + 960 });
      drumNotes.push({ note: snare, at: offset + 1440 });
      for (let i = 0; i < 8; i++) {
        drumNotes.push({ note: hat, at: offset + i * 240, velocity: 70 });
      }
    }

    // Piano: simple chord stabs at beat 1 of each bar (split chord into multiple notes)
    const chord1 = ["C4", "E4", "G4"];
    const chord2 = ["F4", "A4", "C5"];
    const pianoNotes: SequencerNote[] = [
      ...chord1.map((n) => ({
        note: n,
        at: 0,
        duration: "2n",
        velocity: 65,
      })),
      ...chord2.map((n) => ({
        note: n,
        at: 1920,
        duration: "2n",
        velocity: 65,
      })),
    ];

    seq.addTrack(drums, drumNotes);
    seq.addTrack(piano, pianoNotes);
    seqRef.current = seq;
  }

  function togglePlay() {
    const seq = seqRef.current;
    if (!seq) return;
    if (isPlaying) {
      seq.stop();
      setIsPlaying(false);
    } else {
      seq.start();
      setIsPlaying(true);
    }
  }

  useEffect(() => {
    return () => {
      seqRef.current?.stop();
      drumsRef.current?.disconnect();
      pianoRef.current?.disconnect();
    };
  }, []);

  const disabled = status !== "ready";

  return (
    <div>
      <div className="flex gap-2 items-end mb-4">
        <h2 className="text-2xl">Multi-instrument groove</h2>
        <LoadWithStatus status={status} onClick={load} progress={progress} />
      </div>
      <p className="text-zinc-400 text-sm mb-4">
        One Sequencer driving two instruments via separate{" "}
        <code>addTrack</code> calls. Drums + piano play together over a 2-bar
        loop.
      </p>

      <div className={disabled ? "opacity-30 pointer-events-none" : ""}>
        <div className="flex flex-wrap gap-6 mb-4 items-center">
          <button
            className={`px-3 py-1 rounded font-mono ${
              isPlaying ? "bg-rose-700" : "bg-teal-700"
            }`}
            onClick={togglePlay}
          >
            {isPlaying ? "Stop" : "Play"}
          </button>

          <label className="flex gap-2 items-center text-sm">
            <span className="text-zinc-400 w-12">Drums pan</span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={drumsPan}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                setDrumsPan(v);
                if (drumsRef.current) drumsRef.current.output.pan = v;
              }}
            />
            <span className="w-10 text-xs">{drumsPan.toFixed(2)}</span>
          </label>

          <label className="flex gap-2 items-center text-sm">
            <span className="text-zinc-400 w-12">Piano pan</span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={pianoPan}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                setPianoPan(v);
                if (pianoRef.current) pianoRef.current.output.pan = v;
              }}
            />
            <span className="w-10 text-xs">{pianoPan.toFixed(2)}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
