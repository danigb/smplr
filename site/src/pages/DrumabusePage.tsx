import { useEffect, useRef, useState } from "react";
import {
  DrumAbuse,
  getDrumAbusePackNames,
  getDrumAbuseMachinesForPack,
  Sequencer,
  type SequencerNote,
} from "smplr";
import { getAudioContext } from "src/audio-context";
import { LoadWithStatus, useStatus } from "src/useStatus";
import { useTitle } from "../useTitle";

const STEPS = 16;
const STEP_TICKS = 120; // 480 PPQ / 4 = 16th note
const LOOP_TICKS = STEPS * STEP_TICKS;
const RATCHET_STEPS = 8;
const RATCHET_STEP_TICKS = LOOP_TICKS / RATCHET_STEPS; // 8th notes
const DEFAULT_MACHINE = "roland-tr-808";

type TrackId = "kick" | "snare" | "hat" | "ride";

type Track = {
  id: TrackId;
  group: string;
  muted: boolean;
  solo: boolean;
  volume: number;
};

export function DrumabusePage() {
  useTitle("smplr — drumabuse");
  const { status, setStatus, progress, onLoadProgress } = useStatus();

  const drumsRef = useRef<DrumAbuse | null>(null);
  const seqRef = useRef<Sequencer | null>(null);
  const rafRef = useRef<number | null>(null);
  const tracksRef = useRef<Track[]>([]);

  const [machine, setMachine] = useState(DEFAULT_MACHINE);
  const [bpm, setBpm] = useState(110);
  const [position, setPosition] = useState("1:1:0");
  const [isPlaying, setIsPlaying] = useState(false);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [grid, setGrid] = useState<boolean[][]>([]);
  const [activeStep, setActiveStep] = useState(-1);

  const [humanizeTiming, setHumanizeTiming] = useState(0);
  const [humanizeVelocity, setHumanizeVelocity] = useState(0);

  const [ratchets, setRatchets] = useState<number[]>(() =>
    Array<number>(RATCHET_STEPS).fill(0),
  );
  const [ratchetDecay, setRatchetDecay] = useState(0.3);

  tracksRef.current = tracks;

  function load(machineId: string) {
    drumsRef.current?.dispose();
    seqRef.current?.stop();
    setStatus("loading");
    setIsPlaying(false);
    setActiveStep(-1);
    setPosition("1:1:0");

    const context = getAudioContext();
    const drums = DrumAbuse(context, {
      source: { kind: "machine", machine: machineId },
      onLoadProgress,
    });

    drums.load
      .then(() => {
        drumsRef.current = drums;

        const groups = drums.getGroupNames();
        const kick = groups.find((g) => /kick|bd/i.test(g)) ?? groups[0];
        const snare =
          groups.find((g) => /snare|sd|sn/i.test(g)) ?? groups[1] ?? kick;
        const hat =
          groups.find((g) => /hat|hh/i.test(g)) ?? groups[2] ?? kick;
        const ride =
          groups.find((g) => /ride|cy|crash/i.test(g)) ?? groups[3] ?? hat;

        const initialTracks: Track[] = [
          { id: "kick", group: kick, muted: false, solo: false, volume: 1 },
          { id: "snare", group: snare, muted: false, solo: false, volume: 1 },
          { id: "hat", group: hat, muted: false, solo: false, volume: 0.8 },
          { id: "ride", group: ride, muted: false, solo: false, volume: 0.7 },
        ];

        const seq = Sequencer(context, {
          bpm,
          loop: true,
          loopEnd: LOOP_TICKS,
          stepSize: STEP_TICKS,
        });
        seq.on("step", (stepIndex: number) =>
          setActiveStep(stepIndex % STEPS),
        );
        seqRef.current = seq;

        setTracks(initialTracks);
        setGrid(initialTracks.map(() => Array<boolean>(STEPS).fill(false)));
        setRatchets(Array<number>(RATCHET_STEPS).fill(0));
        setStatus("ready");
      })
      .catch((err) => {
        console.error("DrumAbuse error", err);
        setStatus("error");
      });
  }

  // Rebuild all sequencer tracks whenever the pattern, humanize, or ratchet
  // settings change. Mute/solo/volume live changes are applied directly via
  // seq.muteTrack / seq.setTrackVolume in `updateTrack` to avoid rebuilds
  // mid-playback; the rebuild uses tracksRef so it picks up current values
  // when other deps trigger it.
  useEffect(() => {
    const seq = seqRef.current;
    const drums = drumsRef.current;
    const currentTracks = tracksRef.current;
    if (!seq || !drums || currentTracks.length === 0) return;

    seq.clearTracks();

    currentTracks.forEach((t, rowIdx) => {
      const notes: SequencerNote[] =
        grid[rowIdx]?.flatMap((on, step) =>
          on
            ? [
                {
                  note: t.group,
                  at: step * STEP_TICKS,
                  duration: STEP_TICKS,
                  velocity: 100,
                },
              ]
            : [],
        ) ?? [];
      if (notes.length > 0) {
        seq.addTrack(drums, notes, {
          id: t.id,
          volume: t.volume,
          muted: t.muted,
          solo: t.solo,
          humanize: {
            timingMs: humanizeTiming,
            velocity: humanizeVelocity,
          },
        });
      }
    });

    const hat = currentTracks.find((t) => t.id === "hat");
    if (hat && ratchets.some((r) => r > 0)) {
      const ratchetNotes: SequencerNote[] = ratchets.flatMap((r, i) =>
        r > 0
          ? [
              {
                note: hat.group,
                at: i * RATCHET_STEP_TICKS,
                duration: RATCHET_STEP_TICKS,
                ratchet: r,
                ratchetVelocityDecay: ratchetDecay,
              },
            ]
          : [],
      );
      seq.addTrack(drums, ratchetNotes, {
        id: "ratchet-hat",
        volume: hat.volume,
        humanize: {
          timingMs: humanizeTiming,
          velocity: humanizeVelocity,
        },
      });
    }
  }, [
    grid,
    humanizeTiming,
    humanizeVelocity,
    ratchets,
    ratchetDecay,
    status,
  ]);

  // Position readout via rAF while playing.
  useEffect(() => {
    if (!isPlaying) return;
    const tick = () => {
      if (seqRef.current) setPosition(seqRef.current.position);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  // Unmount cleanup.
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      seqRef.current?.stop();
      drumsRef.current?.dispose();
    };
  }, []);

  function togglePlay() {
    const seq = seqRef.current;
    if (!seq) return;
    if (isPlaying) {
      seq.stop();
      setIsPlaying(false);
      setActiveStep(-1);
      setPosition("1:1:0");
    } else {
      seq.start();
      setIsPlaying(true);
    }
  }

  function toggleStep(rowIdx: number, step: number) {
    setGrid((prev) =>
      prev.map((row, r) =>
        r === rowIdx ? row.map((on, s) => (s === step ? !on : on)) : row,
      ),
    );
  }

  function cycleRatchet(step: number) {
    setRatchets((prev) =>
      prev.map((r, i) => (i === step ? (r + 1) % 5 : r)),
    );
  }

  function updateTrack(id: TrackId, patch: Partial<Track>) {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const seq = seqRef.current;
    if (!seq) return;
    if (patch.muted !== undefined) {
      if (patch.muted) seq.muteTrack(id);
      else seq.unmuteTrack(id);
    }
    if (patch.solo !== undefined) {
      if (patch.solo) seq.soloTrack(id);
      else seq.unsoloTrack(id);
    }
    if (patch.volume !== undefined) seq.setTrackVolume(id, patch.volume);
  }

  function changeBpm(v: number) {
    setBpm(v);
    if (seqRef.current) seqRef.current.bpm = v;
  }

  const disabled = status !== "ready";

  return (
    <div>
      <div className="flex gap-2 items-end mb-2">
        <h1 className="text-3xl">DrumAbuse</h1>
        <LoadWithStatus
          status={status}
          progress={progress}
          onClick={() => load(machine)}
        />
      </div>
      <p className="text-zinc-400 text-sm mb-4">
        Sampled instrument for the{" "}
        <a
          className="underline"
          href="https://www.youtube.com/watch?v=Ay-U9eYKmGA"
          target="_blank"
          rel="noreferrer"
        >
          Synthabuse
        </a>{" "}
        drum-machine collection (~210 vintage machines across 5 packs). Step
        grid, per-track mixer, humanize, and a ratchet row — all driven by{" "}
        <code>Sequencer</code>.
      </p>

      <div className={disabled ? "opacity-30 pointer-events-none" : ""}>
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <select
            className="appearance-none bg-zinc-700 text-zinc-200 rounded-sm border border-gray-400 py-1 px-3 text-sm focus:outline-hidden focus:border-blue-500"
            value={machine}
            onChange={(e) => {
              const newMachine = e.target.value;
              if (newMachine !== machine) {
                setMachine(newMachine);
                load(newMachine);
              }
            }}
          >
            {getDrumAbusePackNames().map((pack) => (
              <optgroup key={pack} label={pack}>
                {getDrumAbuseMachinesForPack(pack).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <button
            className={`px-3 py-1 rounded font-mono text-sm ${
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
              max={200}
              step={1}
              value={bpm}
              onChange={(e) => changeBpm(e.target.valueAsNumber)}
            />
            <span className="w-8 font-mono">{bpm}</span>
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
            <span className="w-8 font-mono">{humanizeTiming}</span>
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
            <span className="w-8 font-mono">{humanizeVelocity}</span>
          </label>

          <div className="font-mono text-teal-300 text-sm ml-auto">
            {position}
          </div>
        </div>

        {/* Step grid with per-track mixer column */}
        <div className="overflow-x-auto mb-4">
          {tracks.map((t, rowIdx) => (
            <div key={t.id} className="flex gap-2 mb-1 items-center">
              <div className="w-16 text-sm">{t.id}</div>
              <button
                className={`px-2 py-0.5 rounded text-xs font-mono ${
                  t.muted ? "bg-amber-700" : "bg-zinc-700"
                }`}
                onClick={() => updateTrack(t.id, { muted: !t.muted })}
                title="Mute"
              >
                M
              </button>
              <button
                className={`px-2 py-0.5 rounded text-xs font-mono ${
                  t.solo ? "bg-yellow-600" : "bg-zinc-700"
                }`}
                onClick={() => updateTrack(t.id, { solo: !t.solo })}
                title="Solo"
              >
                S
              </button>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={t.volume}
                className="w-20"
                onChange={(e) =>
                  updateTrack(t.id, { volume: e.target.valueAsNumber })
                }
                title="Volume"
              />
              <div className="w-24 text-xs text-zinc-500 truncate shrink-0">
                {t.group}
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

        {/* Ratchet row (8 eighth-note cells, drives the hat group) */}
        <div className="bg-zinc-800/40 rounded-sm p-3">
          <div className="flex gap-4 items-center mb-2">
            <h2 className="text-sm text-zinc-400 font-mono">
              Ratchet (hat) ·{" "}
              {tracks.find((t) => t.id === "hat")?.group ?? "—"}
            </h2>
            <label className="flex gap-2 items-center text-sm">
              <span className="text-zinc-400">Vel decay</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={ratchetDecay}
                onChange={(e) => setRatchetDecay(e.target.valueAsNumber)}
              />
              <span className="w-10 font-mono">{ratchetDecay.toFixed(2)}</span>
            </label>
            <p className="text-xs text-zinc-500">
              Click to cycle 0→4 sub-divisions per eighth note.
            </p>
          </div>
          <div className="flex gap-1">
            {ratchets.map((r, step) => (
              <button
                key={step}
                className={[
                  "w-12 h-12 rounded-sm text-sm font-mono transition-colors",
                  r > 0
                    ? "bg-teal-600 hover:bg-teal-500"
                    : "bg-zinc-700 hover:bg-zinc-600",
                ].join(" ")}
                onClick={() => cycleRatchet(step)}
              >
                {r > 0 ? `×${r}` : "·"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
