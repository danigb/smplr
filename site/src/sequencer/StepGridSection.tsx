import { useEffect, useRef, useState } from "react";
import { DrumMachine, Sequencer } from "smplr";
import { getAudioContext } from "src/audio-context";
import { LoadWithStatus, useStatus } from "src/useStatus";

const STEPS = 16;
const STEP_TICKS = 120; // 480 PPQ / 4 = 16th note
const LOOP_TICKS = STEPS * STEP_TICKS;

export function StepGridSection() {
  const { status, setStatus, progress, onLoadProgress } = useStatus();

  const drumsRef = useRef<DrumMachine | null>(null);
  const seqRef = useRef<Sequencer | null>(null);

  const [groups, setGroups] = useState<string[]>([]);
  const [grid, setGrid] = useState<boolean[][]>([]);
  const [bpm, setBpm] = useState(120);
  const [humanizeTiming, setHumanizeTiming] = useState(0);
  const [humanizeVelocity, setHumanizeVelocity] = useState(0);
  const [activeStep, setActiveStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  const gridRef = useRef<boolean[][]>([]);
  const groupsRef = useRef<string[]>([]);
  const humanizeRef = useRef({ timingMs: 0, velocity: 0 });
  gridRef.current = grid;
  groupsRef.current = groups;
  humanizeRef.current = {
    timingMs: humanizeTiming,
    velocity: humanizeVelocity,
  };

  function load() {
    setStatus("loading");
    const context = getAudioContext();
    const drums = DrumMachine(context, {
      instrument: "TR-808",
      onLoadProgress,
    });

    drums.load
      .then(() => {
        const rows = drums.getGroupNames().slice(0, 4);
        const initGrid = rows.map(() => Array<boolean>(STEPS).fill(false));
        drumsRef.current = drums;
        gridRef.current = initGrid;
        groupsRef.current = rows;
        setGroups(rows);
        setGrid(initGrid);

        const seq = Sequencer(context, {
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

  // Rebuild tracks on grid or humanize change, applying per-track humanize.
  useEffect(() => {
    const seq = seqRef.current;
    const drums = drumsRef.current;
    if (!seq || !drums || groupsRef.current.length === 0) return;

    seq.clearTracks();
    groupsRef.current.forEach((group, rowIdx) => {
      const notes = gridRef.current[rowIdx].flatMap((on, step) =>
        on ? [{ note: group, at: step * STEP_TICKS }] : [],
      );
      if (notes.length > 0) {
        seq.addTrack(drums, notes, {
          humanize: {
            timingMs: humanizeRef.current.timingMs,
            velocity: humanizeRef.current.velocity,
          },
        });
      }
    });
  }, [grid, humanizeTiming, humanizeVelocity]);

  function toggleStep(rowIdx: number, step: number) {
    setGrid((prev) =>
      prev.map((row, r) =>
        r === rowIdx ? row.map((on, s) => (s === step ? !on : on)) : row,
      ),
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
        <h2 className="text-2xl">Step grid + humanize</h2>
        <LoadWithStatus status={status} onClick={load} progress={progress} />
      </div>
      <p className="text-zinc-400 text-sm mb-4">
        Click cells to toggle steps. Humanize sliders apply per-track timing and
        velocity randomization.
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
            <span className="text-zinc-400">BPM</span>
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
            <span className="w-8">{bpm}</span>
          </label>

          <label className="flex gap-2 items-center text-sm">
            <span className="text-zinc-400">Timing ±ms</span>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={humanizeTiming}
              onChange={(e) => setHumanizeTiming(e.target.valueAsNumber)}
            />
            <span className="w-8">{humanizeTiming}</span>
          </label>

          <label className="flex gap-2 items-center text-sm">
            <span className="text-zinc-400">Vel ±</span>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={humanizeVelocity}
              onChange={(e) => setHumanizeVelocity(e.target.valueAsNumber)}
            />
            <span className="w-8">{humanizeVelocity}</span>
          </label>
        </div>

        <div className="overflow-x-auto">
          {groups.map((group, rowIdx) => (
            <div key={group} className="flex gap-1 mb-2 items-center">
              <div className="w-24 text-sm text-zinc-400 truncate shrink-0">
                {group}
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: STEPS }, (_, step) => {
                  const isOn = grid[rowIdx]?.[step] ?? false;
                  const isCurrent = step === activeStep;
                  return (
                    <button
                      key={step}
                      className={[
                        "w-7 h-7 rounded-sm text-xs transition-colors",
                        step % 4 === 0 ? "ml-1" : "",
                        isOn && isCurrent
                          ? "ring-2 ring-yellow-300 ring-offset-1 ring-offset-zinc-950"
                          : "",
                        isOn
                          ? "bg-teal-600 hover:bg-teal-500"
                          : isCurrent
                            ? "bg-zinc-500 hover:bg-zinc-400"
                            : "bg-zinc-700 hover:bg-zinc-600",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => toggleStep(rowIdx, step)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
