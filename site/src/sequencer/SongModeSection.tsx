import { useEffect, useRef, useState } from "react";
import { DrumMachine, Sequencer, SequencerNote } from "smplr";
import { getAudioContext } from "src/audio-context";
import { LoadWithStatus, useStatus } from "src/useStatus";

const PATTERN_LABELS = ["A · intro", "B · verse", "C · chorus"];

function buildPatterns(kick: string, snare: string, hat: string) {
  // Intro: just kick on the downbeats
  const A: SequencerNote[] = [0, 1, 2, 3].map((b) => ({
    note: kick,
    at: b * 480,
  }));
  // Verse: kick + backbeat snare + sparse hats
  const B: SequencerNote[] = [
    { note: kick, at: 0 },
    { note: snare, at: 480 },
    { note: kick, at: 960 },
    { note: snare, at: 1440 },
    ...[0, 2, 4, 6].map((i) => ({
      note: hat,
      at: i * 240,
      velocity: 70,
    })),
  ];
  // Chorus: verse + dense hats
  const C: SequencerNote[] = [
    ...B,
    ...[1, 3, 5, 7].map((i) => ({
      note: hat,
      at: i * 240,
      velocity: 55,
    })),
  ];
  return [A, B, C];
}

export function SongModeSection() {
  const { status, setStatus, progress, onLoadProgress } = useStatus();
  const drumsRef = useRef<DrumMachine | null>(null);
  const seqRef = useRef<Sequencer | null>(null);

  const [chainText, setChainText] = useState("0,1,1,2");
  const [activePattern, setActivePattern] = useState<number | null>(null);
  const [loop, setLoop] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ended, setEnded] = useState(false);

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
        const [A, B, C] = buildPatterns(kick, snare, hat);

        const seq = Sequencer(context, { bpm: 110, loop });
        seq.setPatterns([
          { tracks: [{ instrument: drums, notes: A }], loopEnd: "1m" },
          { tracks: [{ instrument: drums, notes: B }], loopEnd: "1m" },
          { tracks: [{ instrument: drums, notes: C }], loopEnd: "1m" },
        ]);
        seq.chainOrder = parseChain(chainText);
        seq.on("patternChange", (idx: number) => setActivePattern(idx));
        seq.on("end", () => {
          setEnded(true);
          setIsPlaying(false);
        });
        seqRef.current = seq;
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  function parseChain(text: string): number[] {
    const order = text
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 2);
    return order.length > 0 ? order : [0];
  }

  function applyChain() {
    const seq = seqRef.current;
    if (!seq) return;
    try {
      seq.chainOrder = parseChain(chainText);
    } catch {
      /* invalid input — ignore */
    }
  }

  function togglePlay() {
    const seq = seqRef.current;
    if (!seq) return;
    if (isPlaying) {
      seq.stop();
      setIsPlaying(false);
      setActivePattern(null);
    } else {
      setEnded(false);
      seq.start();
      setIsPlaying(true);
    }
  }

  // Loop toggle takes effect immediately.
  useEffect(() => {
    if (seqRef.current) seqRef.current.loop = loop;
  }, [loop]);

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
        <h2 className="text-2xl">Song mode · setPatterns + chainOrder</h2>
        <LoadWithStatus status={status} onClick={load} progress={progress} />
      </div>
      <p className="text-zinc-400 text-sm mb-4">
        Three patterns (A, B, C) chained via <code>chainOrder</code>. Edit the
        order, toggle loop, and watch <code>patternChange</code> highlight the
        active pattern.
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
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
            />
            <span className="text-zinc-400">Loop chain</span>
          </label>
          <label className="flex gap-2 items-center text-sm">
            <span className="text-zinc-400">chainOrder</span>
            <input
              type="text"
              className="bg-zinc-700 px-2 py-1 rounded-sm w-24 text-sm font-mono"
              value={chainText}
              onChange={(e) => setChainText(e.target.value)}
              onBlur={applyChain}
              placeholder="0,1,1,2"
            />
          </label>
          {ended && <span className="text-amber-400 text-sm">chain ended</span>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {PATTERN_LABELS.map((label, i) => (
            <div
              key={label}
              className={[
                "p-3 rounded-sm border text-sm",
                activePattern === i
                  ? "border-teal-500 bg-teal-900/30"
                  : "border-zinc-700 bg-zinc-800/30",
              ].join(" ")}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
