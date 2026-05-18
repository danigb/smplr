import { useEffect, useMemo, useRef, useState } from "react";
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
const DEFAULT_MACHINE = "roland-tr-808";

type Slot = {
  name: string;
};

// Canonical instrument names, copied verbatim from the drum-abuse pack
// metadata's `instruments` array in docs/drum-abuse/pack{1..5}.json.
// Each name matches `getGroupNames()` exactly — TR-808's
// sample_instruments uses the TitleCase display form ("Kick", "Snare",
// "Hi-Hat Closed"), not the lowercase slug variant.
// Ordered roughly drum-kit → percussion → vintage → catch-all.
const SLOTS: Slot[] = [
  { name: "Kick" },
  { name: "Snare" },
  { name: "Rim" },
  { name: "Clap" },
  { name: "Hi-Hat Closed" },
  { name: "Hi-Hat Open" },
  { name: "Tom" },
  { name: "Ride" },
  { name: "Crash" },
  { name: "Cymbal" },
  { name: "Cowbell" },
  { name: "Clave" },
  { name: "Click" },
  { name: "Conga" },
  { name: "Bongo" },
  { name: "Timbale" },
  { name: "Shaker" },
  { name: "Tambourine" },
  { name: "Cabasa" },
  { name: "Guiro" },
  { name: "Agogo" },
  { name: "Wood Block" },
  { name: "Triangle" },
  { name: "Bell" },
  { name: "Tabla" },
  { name: "Vibraslap" },
  { name: "Whistle" },
  { name: "Cuica" },
  { name: "Gong" },
  { name: "FX" },
  { name: "Perc" },
];

type Mixer = { muted: boolean; solo: boolean; volume: number };

function initialPatterns(): Record<string, boolean[]> {
  return Object.fromEntries(
    SLOTS.map((s) => [s.name, Array<boolean>(STEPS).fill(false)]),
  );
}

function initialMixers(): Record<string, Mixer> {
  return Object.fromEntries(
    SLOTS.map((s) => [s.name, { muted: false, solo: false, volume: 1 }]),
  );
}

// Exact-slug match against the groups returned by `drums.getGroupNames()`.
// Returns `{ slug → matchedGroup | null }` for every slot.
function computeMapping(groups: string[]): Record<string, string | null> {
  const available = new Set(groups);
  const result: Record<string, string | null> = {};
  for (const slot of SLOTS) {
    result[slot.name] = available.has(slot.name) ? slot.name : null;
  }
  return result;
}

export function DrumabusePage() {
  useTitle("smplr — drumabuse");
  const { status, setStatus, progress, onLoadProgress } = useStatus();

  const drumsRef = useRef<DrumAbuse | null>(null);
  const seqRef = useRef<Sequencer | null>(null);
  const rafRef = useRef<number | null>(null);
  // Tracks the most recently requested machine; lets us ignore stale loads
  // when the user changes the selection again before the previous load
  // finished.
  const loadingMachineRef = useRef<string | null>(null);

  const [machine, setMachine] = useState(DEFAULT_MACHINE);
  const [bpm, setBpm] = useState(110);
  const [position, setPosition] = useState("1:1:0");
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  // True after the first successful load. Controls whether the whole page is
  // greyed out (only on the very first load) or interactive (during hot
  // machine-swaps while playing).
  const [hasLoaded, setHasLoaded] = useState(false);

  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [patterns, setPatterns] =
    useState<Record<string, boolean[]>>(initialPatterns);
  const [mixers, setMixers] = useState<Record<string, Mixer>>(initialMixers);

  const [humanizeTiming, setHumanizeTiming] = useState(0);
  const [humanizeVelocity, setHumanizeVelocity] = useState(0);

  // Mixer changes are applied live via seq.muteTrack / setTrackVolume,
  // so the rebuild useEffect reads from this ref instead of depending on
  // `mixers` (which would cause clearTracks() on every M/S/vol click).
  const mixersRef = useRef(mixers);
  mixersRef.current = mixers;

  function load(machineId: string) {
    loadingMachineRef.current = machineId;
    setStatus("loading");

    const context = getAudioContext();
    const drums = DrumAbuse(context, {
      source: { kind: "machine", machine: machineId },
      onLoadProgress,
    });

    drums.load
      .then(() => {
        // Ignore if the user requested another machine in the meantime.
        if (loadingMachineRef.current !== machineId) {
          drums.dispose();
          return;
        }

        // Hot-swap the drum machine. If the sequencer is playing, it keeps
        // running; the rebuild useEffect (triggered by `setMapping`) calls
        // `seq.clearTracks()` + `seq.addTrack(newDrums, ...)` so audio
        // crossfades to the new machine on the next scheduling tick.
        const oldDrums = drumsRef.current;
        drumsRef.current = drums;

        // First load: create the sequencer once. Subsequent loads reuse it
        // so playback state (position, transport, step highlight) survives.
        if (!seqRef.current) {
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
        }

        setMapping(computeMapping(drums.getGroupNames()));
        setStatus("ready");
        setHasLoaded(true);

        // Dispose the previous drum machine after a short delay so any
        // already-scheduled audio (within the sequencer's lookahead window)
        // can finish before its audio graph is torn down. Avoids a click
        // when swapping mid-playback.
        if (oldDrums) {
          setTimeout(() => oldDrums.dispose(), 500);
        }
      })
      .catch((err) => {
        if (loadingMachineRef.current !== machineId) return;
        console.error("DrumAbuse error", err);
        setStatus("error");
      });
  }

  // Rebuild sequencer tracks whenever the pattern, the slot→group mapping,
  // or humanize changes. Mixer (M/S/vol) changes don't trigger rebuild —
  // they go through seq.muteTrack / setTrackVolume directly.
  useEffect(() => {
    const seq = seqRef.current;
    const drums = drumsRef.current;
    if (!seq || !drums || Object.keys(mapping).length === 0) return;

    seq.clearTracks();
    for (const slot of SLOTS) {
      const group = mapping[slot.name];
      if (!group) continue;
      const pattern = patterns[slot.name] ?? [];
      const mixer = mixersRef.current[slot.name] ?? {
        muted: false,
        solo: false,
        volume: 1,
      };
      const notes: SequencerNote[] = pattern.flatMap((on, step) =>
        on
          ? [
              {
                note: group,
                at: step * STEP_TICKS,
                duration: STEP_TICKS,
                velocity: 100,
              },
            ]
          : [],
      );
      if (notes.length > 0) {
        seq.addTrack(drums, notes, {
          id: slot.name,
          volume: mixer.volume,
          muted: mixer.muted,
          solo: mixer.solo,
          humanize: {
            timingMs: humanizeTiming,
            velocity: humanizeVelocity,
          },
        });
      }
    }
  }, [patterns, mapping, humanizeTiming, humanizeVelocity, status]);

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

  function toggleStep(slotId: string, step: number) {
    setPatterns((prev) => ({
      ...prev,
      [slotId]: (prev[slotId] ?? Array<boolean>(STEPS).fill(false)).map(
        (on, s) => (s === step ? !on : on),
      ),
    }));
  }

  function updateMixer(slotId: string, patch: Partial<Mixer>) {
    setMixers((prev) => ({
      ...prev,
      [slotId]: { ...(prev[slotId] ?? { muted: false, solo: false, volume: 1 }), ...patch },
    }));
    const seq = seqRef.current;
    if (!seq) return;
    if (patch.muted !== undefined) {
      if (patch.muted) seq.muteTrack(slotId);
      else seq.unmuteTrack(slotId);
    }
    if (patch.solo !== undefined) {
      if (patch.solo) seq.soloTrack(slotId);
      else seq.unsoloTrack(slotId);
    }
    if (patch.volume !== undefined) seq.setTrackVolume(slotId, patch.volume);
  }

  function changeBpm(v: number) {
    setBpm(v);
    if (seqRef.current) seqRef.current.bpm = v;
  }

  const mappedSlots = useMemo(
    () => SLOTS.filter((s) => mapping[s.name]),
    [mapping],
  );

  // Only fully disable the page before the very first load completes. Once
  // a machine is loaded, subsequent loads (hot machine swaps) keep the UI
  // interactive so playback isn't interrupted.
  const fullyDisabled = !hasLoaded;

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
        grid covers the canonical drum-instrument vocabulary; rows enable when
        the current machine has a matching sample.
      </p>

      <div className={fullyDisabled ? "opacity-30 pointer-events-none" : ""}>
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

        {/* Sequencer: one row per canonical slot. Rows the current machine
            doesn't have stay visible but their cells are disabled and use
            muted colours (light grey when active, deep zinc when inactive). */}
        <div className="overflow-x-auto mb-6">
          {SLOTS.map((slot) => {
            const group = mapping[slot.name];
            const enabled = !!group;
            const pattern = patterns[slot.name] ?? [];
            return (
              <div key={slot.name} className="flex gap-2 mb-1 items-center">
                <div className="w-28 shrink-0">
                  <div
                    className={`text-sm ${enabled ? "" : "text-zinc-500"}`}
                  >
                    {slot.name}
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: STEPS }, (_, step) => {
                    const isOn = pattern[step] ?? false;
                    const isCurrent = step === activeStep;
                    return (
                      <button
                        key={step}
                        disabled={!enabled}
                        className={[
                          "w-7 h-7 rounded-sm text-xs transition-colors",
                          step % 4 === 0 ? "ml-1" : "",
                          isOn && isCurrent && enabled
                            ? "ring-2 ring-yellow-300 ring-offset-1 ring-offset-zinc-950"
                            : "",
                          !enabled
                            ? isOn
                              ? "bg-zinc-400 cursor-not-allowed"
                              : "bg-zinc-700/30 cursor-not-allowed"
                            : isOn
                              ? "bg-teal-600 hover:bg-teal-500"
                              : isCurrent
                                ? "bg-zinc-500 hover:bg-zinc-400"
                                : "bg-zinc-700 hover:bg-zinc-600",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => enabled && toggleStep(slot.name, step)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mixer: only the slots the current machine actually has. */}
        <div>
          <h2 className="text-lg text-zinc-400 mb-2">Mixer</h2>
          <div className="space-y-1">
            {mappedSlots.map((slot) => {
              const mixer = mixers[slot.name] ?? {
                muted: false,
                solo: false,
                volume: 1,
              };
              return (
                <div
                  key={slot.name}
                  className="flex items-center gap-3 bg-zinc-800/40 rounded-sm px-3 py-2"
                >
                  <div className="w-24 text-sm shrink-0">{slot.name}</div>
                  <button
                    className={`px-2 py-0.5 rounded text-xs font-mono ${
                      mixer.muted ? "bg-amber-700" : "bg-zinc-700"
                    }`}
                    onClick={() =>
                      updateMixer(slot.name, { muted: !mixer.muted })
                    }
                    title="Mute"
                  >
                    M
                  </button>
                  <button
                    className={`px-2 py-0.5 rounded text-xs font-mono ${
                      mixer.solo ? "bg-yellow-600" : "bg-zinc-700"
                    }`}
                    onClick={() =>
                      updateMixer(slot.name, { solo: !mixer.solo })
                    }
                    title="Solo"
                  >
                    S
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={mixer.volume}
                    className="flex-1 max-w-[200px]"
                    onChange={(e) =>
                      updateMixer(slot.name, {
                        volume: e.target.valueAsNumber,
                      })
                    }
                    title="Volume"
                  />
                  <span className="w-10 text-xs text-zinc-400 font-mono">
                    {mixer.volume.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
