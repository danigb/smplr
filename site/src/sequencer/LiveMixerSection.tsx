import { useEffect, useRef, useState } from "react";
import { DrumMachine, Sequencer, SequencerNote, TimeSignature } from "smplr";
import { getAudioContext } from "src/audio-context";
import { LoadWithStatus, useStatus } from "src/useStatus";

type TrackId = "kick" | "snare" | "hat" | "ride";

type TrackState = {
  id: TrackId;
  group: string;
  muted: boolean;
  solo: boolean;
  volume: number;
};

const TIME_SIGS: Record<string, TimeSignature> = {
  "4/4": { numerator: 4, denominator: 4 },
  "3/4": { numerator: 3, denominator: 4 },
  "7/8": { numerator: 7, denominator: 8 },
};

function buildTrackNotes(
  group: string,
  pattern: number[],
  stepTicks: number,
): SequencerNote[] {
  return pattern.flatMap((on, i) =>
    on > 0 ? [{ note: group, at: i * stepTicks, velocity: 100 }] : [],
  );
}

export function LiveMixerSection() {
  const { status, setStatus, progress, onLoadProgress } = useStatus();
  const drumsRef = useRef<DrumMachine | null>(null);
  const seqRef = useRef<Sequencer | null>(null);
  const rafRef = useRef<number | null>(null);

  const [tracks, setTracks] = useState<TrackState[]>([]);
  const [bpm, setBpm] = useState(110);
  const [sigKey, setSigKey] = useState<keyof typeof TIME_SIGS>("4/4");
  const [position, setPosition] = useState("1:1:0");
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
        drumsRef.current = drums;
        const groups = drums.getGroupNames();
        const kick = groups.find((g) => /kick|bd/i.test(g)) ?? groups[0];
        const snare =
          groups.find((g) => /snare|sd/i.test(g)) ?? groups[1] ?? kick;
        const hat = groups.find((g) => /hat|hh/i.test(g)) ?? groups[2] ?? kick;
        const ride = groups.find((g) => /ride|cy/i.test(g)) ?? groups[3] ?? hat;

        const initial: TrackState[] = [
          { id: "kick", group: kick, muted: false, solo: false, volume: 1 },
          { id: "snare", group: snare, muted: false, solo: false, volume: 1 },
          { id: "hat", group: hat, muted: false, solo: false, volume: 0.8 },
          { id: "ride", group: ride, muted: false, solo: false, volume: 0.7 },
        ];

        const seq = Sequencer(context, {
          bpm,
          timeSignature: TIME_SIGS[sigKey],
          loop: true,
          loopEnd: "1m",
        });

        const STEP = 120; // 16th note
        // Kick: 1 & 3
        seq.addTrack(
          drums,
          buildTrackNotes(
            kick,
            [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            STEP,
          ),
          { id: "kick", volume: 1 },
        );
        // Snare: 2 & 4
        seq.addTrack(
          drums,
          buildTrackNotes(
            snare,
            [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            STEP,
          ),
          { id: "snare", volume: 1 },
        );
        // Hats: every 8th
        seq.addTrack(
          drums,
          buildTrackNotes(
            hat,
            [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
            STEP,
          ),
          { id: "hat", volume: 0.8 },
        );
        // Ride: every 4th
        seq.addTrack(
          drums,
          buildTrackNotes(
            ride,
            [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            STEP,
          ),
          { id: "ride", volume: 0.7 },
        );

        seqRef.current = seq;
        setTracks(initial);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  function togglePlay() {
    const seq = seqRef.current;
    if (!seq) return;
    if (isPlaying) {
      seq.stop();
      setIsPlaying(false);
      setPosition("1:1:0");
    } else {
      seq.start();
      setIsPlaying(true);
    }
  }

  // Position readout via requestAnimationFrame while playing.
  useEffect(() => {
    if (!isPlaying) return;
    const tick = () => {
      const seq = seqRef.current;
      if (seq) setPosition(seq.position);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      seqRef.current?.stop();
      drumsRef.current?.disconnect();
    };
  }, []);

  function updateTrack(id: TrackId, patch: Partial<TrackState>) {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
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

  function changeSig(key: keyof typeof TIME_SIGS) {
    setSigKey(key);
    if (seqRef.current) seqRef.current.timeSignature = TIME_SIGS[key];
  }

  const disabled = status !== "ready";

  return (
    <div>
      <div className="flex gap-2 items-end mb-4">
        <h2 className="text-2xl">Live mixer · bar:beat:tick</h2>
        <LoadWithStatus status={status} onClick={load} progress={progress} />
      </div>
      <p className="text-zinc-400 text-sm mb-4">
        Mute, solo, and set per-track volume on a live sequence. Position
        readout is driven by the Sequencer's <code>position</code> getter.
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
              max={200}
              step={1}
              value={bpm}
              onChange={(e) => changeBpm(e.target.valueAsNumber)}
            />
            <span className="w-8">{bpm}</span>
          </label>
          <label className="flex gap-2 items-center text-sm">
            <span className="text-zinc-400">Time sig</span>
            <select
              className="bg-zinc-700 px-2 py-1 rounded-sm"
              value={sigKey}
              onChange={(e) =>
                changeSig(e.target.value as keyof typeof TIME_SIGS)
              }
            >
              {Object.keys(TIME_SIGS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <div className="font-mono text-teal-300 text-sm ml-auto">
            {position}
          </div>
        </div>

        <div className="space-y-2">
          {tracks.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 bg-zinc-800/40 rounded-sm px-3 py-2"
            >
              <div className="w-16 text-sm">{t.id}</div>
              <button
                className={`px-2 py-0.5 rounded text-xs font-mono ${
                  t.muted ? "bg-amber-700" : "bg-zinc-700"
                }`}
                onClick={() => updateTrack(t.id, { muted: !t.muted })}
              >
                M
              </button>
              <button
                className={`px-2 py-0.5 rounded text-xs font-mono ${
                  t.solo ? "bg-yellow-600" : "bg-zinc-700"
                }`}
                onClick={() => updateTrack(t.id, { solo: !t.solo })}
              >
                S
              </button>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={t.volume}
                className="flex-1"
                onChange={(e) =>
                  updateTrack(t.id, { volume: e.target.valueAsNumber })
                }
              />
              <span className="w-10 text-xs text-zinc-400">
                {t.volume.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
