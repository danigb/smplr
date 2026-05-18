import { useEffect, useRef, useState } from "react";
import { DrumMachine, Sequencer, SequencerNote } from "smplr";
import { getAudioContext } from "src/audio-context";
import { LoadWithStatus, useStatus } from "src/useStatus";

const STEPS = 8;
const STEP_TICKS = 240; // 480 PPQ / 2 = 8th note
const LOOP_TICKS = STEPS * STEP_TICKS;

export function RatchetSection() {
  const { status, setStatus, progress, onLoadProgress } = useStatus();
  const drumsRef = useRef<DrumMachine | null>(null);
  const seqRef = useRef<Sequencer | null>(null);
  const hatRef = useRef<string>("");

  const [ratchets, setRatchets] = useState<number[]>(() =>
    Array<number>(STEPS).fill(1),
  );
  const [decay, setDecay] = useState(0.3);
  const [activeStep, setActiveStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  function load() {
    setStatus("loading");
    const context = getAudioContext();
    const drums = DrumMachine(context, {
      instrument: "TR-808",
      onLoadProgress,
    });
    drums.load
      .then(() => {
        const groups = drums.getGroupNames();
        // Find a hat-like group; fall back to the first group.
        const hat =
          groups.find((g) => /hat|hh|hi-?hat/i.test(g)) ?? groups[0];
        hatRef.current = hat;
        drumsRef.current = drums;

        const seq = Sequencer(context, {
          bpm: 110,
          loop: true,
          loopEnd: LOOP_TICKS,
          stepSize: STEP_TICKS,
        });
        seq.on("step", (stepIndex: number) =>
          setActiveStep(stepIndex % STEPS),
        );
        seqRef.current = seq;
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  // Rebuild track whenever ratchets or decay change.
  useEffect(() => {
    const seq = seqRef.current;
    const drums = drumsRef.current;
    const hat = hatRef.current;
    if (!seq || !drums || !hat) return;

    const notes: SequencerNote[] = ratchets.flatMap((ratchet, i) =>
      ratchet > 0
        ? [
            {
              note: hat,
              at: i * STEP_TICKS,
              duration: STEP_TICKS,
              ratchet,
              ratchetVelocityDecay: decay,
            },
          ]
        : [],
    );
    seq.clearTracks();
    if (notes.length > 0) seq.addTrack(drums, notes);
  }, [ratchets, decay, status]);

  function cycleRatchet(step: number) {
    setRatchets((prev) =>
      prev.map((r, i) => (i === step ? (r + 1) % 5 : r)),
    );
  }

  function togglePlay() {
    const seq = seqRef.current;
    if (!seq) return;
    if (isPlaying) {
      seq.stop();
      setActiveStep(-1);
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
    };
  }, []);

  const disabled = status !== "ready";

  return (
    <div>
      <div className="flex gap-2 items-end mb-4">
        <h2 className="text-2xl">Ratchet + velocity decay</h2>
        <LoadWithStatus status={status} onClick={load} progress={progress} />
      </div>
      <p className="text-zinc-400 text-sm mb-4">
        Click cells to cycle ratchet count (0–4). Each step subdivides into N
        equally-spaced triggers over its duration. Velocity decay scales each
        sub-note by (1 − decay) <sup>step</sup>.
      </p>

      <div className={disabled ? "opacity-30 pointer-events-none" : ""}>
        <div className="flex flex-wrap gap-4 mb-4 items-center">
          <button
            className={`px-3 py-1 rounded font-mono ${
              isPlaying ? "bg-rose-700" : "bg-teal-700"
            }`}
            onClick={togglePlay}
          >
            {isPlaying ? "Stop" : "Play"}
          </button>
          <label className="flex gap-2 items-center text-sm">
            <span className="text-zinc-400">Velocity decay</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={decay}
              onChange={(e) => setDecay(e.target.valueAsNumber)}
            />
            <span className="w-10">{decay.toFixed(2)}</span>
          </label>
        </div>

        <div className="flex gap-1">
          {ratchets.map((ratchet, step) => (
            <button
              key={step}
              className={[
                "w-12 h-12 rounded-sm text-sm font-mono transition-colors",
                step === activeStep
                  ? "ring-2 ring-white ring-offset-1 ring-offset-zinc-950"
                  : "",
                ratchet > 0
                  ? "bg-teal-600 hover:bg-teal-500"
                  : "bg-zinc-700 hover:bg-zinc-600",
              ].join(" ")}
              onClick={() => cycleRatchet(step)}
            >
              {ratchet > 0 ? `×${ratchet}` : "·"}
            </button>
          ))}
        </div>
        <div className="text-xs text-zinc-500 mt-2">
          Group: {hatRef.current || "—"}
        </div>
      </div>
    </div>
  );
}
