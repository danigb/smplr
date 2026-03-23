import { useEffect, useRef, useState } from "react";
import { DrumMachine, Sequencer } from "smplr";
import { getAudioContext } from "./audio-context";
import { LoadWithStatus, useStatus } from "./useStatus";

const STEPS = 16;
// 480 PPQ / 4 = 120 ticks per 16th note
const STEP_TICKS = 120;
// 16 steps = 1 measure
const LOOP_TICKS = STEPS * STEP_TICKS;

export function SequencerExample({ className }: { className?: string }) {
  const { status, setStatus, progress, onLoadProgress } = useStatus();

  const drumsRef = useRef<DrumMachine | null>(null);
  const seqRef = useRef<Sequencer | null>(null);

  const [groups, setGroups] = useState<string[]>([]);
  const [grid, setGrid] = useState<boolean[][]>([]);
  const [chance, setChance] = useState<number[]>([]);
  const [bpm, setBpm] = useState(120);
  const [pan, setPan] = useState(0);
  const [activeStep, setActiveStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  // Keep refs so the track-rebuild effect always sees current values without
  // triggering extra re-renders.
  const gridRef = useRef<boolean[][]>([]);
  const chanceRef = useRef<number[]>([]);
  const groupsRef = useRef<string[]>([]);
  gridRef.current = grid;
  chanceRef.current = chance;
  groupsRef.current = groups;

  function load() {
    setStatus("loading");
    const context = getAudioContext();
    const drums = DrumMachine(context, { instrument: "TR-808", onLoadProgress });

    drums.load
      .then(() => {
        const rows = drums.getGroupNames().slice(0, 4);
        const initGrid = rows.map(() => Array<boolean>(STEPS).fill(false));
        const initChance = rows.map(() => 100);

        drumsRef.current = drums;
        gridRef.current = initGrid;
        chanceRef.current = initChance;
        groupsRef.current = rows;
        setGroups(rows);
        setGrid(initGrid);
        setChance(initChance);

        const seq = new Sequencer(context, {
          bpm: 120,
          loop: true,
          loopEnd: LOOP_TICKS,
          stepSize: STEP_TICKS,
        });

        seq.on("step", (stepIndex: number) => {
          setActiveStep(stepIndex % STEPS);
        });

        seqRef.current = seq;
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  // Rebuild sequencer tracks whenever grid or chance changes.
  useEffect(() => {
    const seq = seqRef.current;
    const drums = drumsRef.current;
    if (!seq || !drums || groupsRef.current.length === 0) return;

    seq.clearTracks();
    groupsRef.current.forEach((group, rowIdx) => {
      const notes = gridRef.current[rowIdx].flatMap((on, step) =>
        on
          ? [{ note: group, at: step * STEP_TICKS, chance: chanceRef.current[rowIdx] }]
          : []
      );
      if (notes.length > 0) seq.addTrack(drums, notes);
    });
  }, [grid, chance]);

  function toggleStep(rowIdx: number, step: number) {
    setGrid((prev) =>
      prev.map((row, r) =>
        r === rowIdx ? row.map((on, s) => (s === step ? !on : on)) : row
      )
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

  const disabled = status !== "ready";

  return (
    <div className={className}>
      <div className="flex gap-2 items-end mb-2">
        <h1 className="text-3xl">Sequencer</h1>
        <LoadWithStatus status={status} onClick={load} progress={progress} />
      </div>

      <div className={disabled ? "opacity-30 pointer-events-none" : ""}>
        {/* Transport controls */}
        <div className="flex flex-wrap gap-4 mb-4 items-center">
          <button
            className={`px-3 py-1 rounded font-mono ${isPlaying ? "bg-rose-700" : "bg-teal-700"}`}
            onClick={togglePlay}
          >
            {isPlaying ? "Stop" : "Play"}
          </button>

          <label className="flex gap-2 items-center">
            <span className="text-sm text-zinc-400">BPM</span>
            <input
              type="range"
              min={60}
              max={240}
              step={1}
              value={bpm}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                setBpm(v);
                if (seqRef.current) seqRef.current.bpm = v;
              }}
            />
            <span className="text-sm w-8">{bpm}</span>
          </label>

          <label className="flex gap-2 items-center">
            <span className="text-sm text-zinc-400">Pan</span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={pan}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                setPan(v);
                if (drumsRef.current) drumsRef.current.output.pan = v;
              }}
            />
            <span className="text-sm w-10">{pan.toFixed(2)}</span>
          </label>
        </div>

        {/* Step grid */}
        <div className="overflow-x-auto">
          {groups.map((group, rowIdx) => (
            <div key={group} className="flex gap-1 mb-2 items-center">
              {/* Row label */}
              <div className="w-24 text-sm text-zinc-400 truncate flex-shrink-0">
                {group}
              </div>

              {/* Steps */}
              <div className="flex gap-0.5">
                {Array.from({ length: STEPS }, (_, step) => (
                  <button
                    key={step}
                    className={[
                      "w-7 h-7 rounded text-xs transition-colors",
                      step % 4 === 0 ? "ml-1" : "",
                      step === activeStep
                        ? "ring-2 ring-white ring-offset-1 ring-offset-zinc-950"
                        : "",
                      grid[rowIdx]?.[step]
                        ? "bg-teal-600 hover:bg-teal-500"
                        : "bg-zinc-700 hover:bg-zinc-600",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => toggleStep(rowIdx, step)}
                  />
                ))}
              </div>

              {/* Chance slider */}
              <label className="flex gap-1 items-center ml-3 flex-shrink-0">
                <span className="text-xs text-zinc-500 w-12">chance</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={chance[rowIdx] ?? 100}
                  className="w-20"
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    setChance((prev) =>
                      prev.map((c, i) => (i === rowIdx ? v : c))
                    );
                  }}
                />
                <span className="text-xs w-8">{chance[rowIdx]}%</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
