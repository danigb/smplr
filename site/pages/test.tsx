import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { Note } from "tonal";
import {
  DrumMachine,
  ElectricPiano,
  Mallet,
  Mellotron,
  Smolken,
  Soundfont,
  SplendidGrandPiano,
  Versilian,
  getDrumMachineNames,
  getElectricPianoNames,
  getMalletNames,
  getMellotronNames,
  getSmolkenNames,
  getSoundfontNames,
  getVersilianInstruments,
} from "smplr";
import { getAudioContext } from "../src/audio-context";

// ── helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      resolve();
    });
  });
}

function chromaticNotes(lo: number, hi: number): number[] {
  const up = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  return [...up, ...[...up].reverse().slice(1)];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── log API ──────────────────────────────────────────────────────────────────

type LogApi = {
  append: (line: string) => void;
  replaceLast: (line: string) => void;
};

function makeProgressHandler(log: LogApi) {
  return ({ loaded, total }: { loaded: number; total: number }) => {
    log.replaceLast(`  Loading… ${loaded} / ${total}`);
  };
}

// ── melody / drum players ────────────────────────────────────────────────────

type PlayableInstrument = {
  start: (event: {
    note: number;
    duration?: number;
    velocity?: number;
    onStart?: () => void;
    onEnded?: () => void;
  }) => unknown;
  disconnect: () => void;
};

async function playMelody(
  instrument: PlayableInstrument,
  notes: number[],
  msPerNote: number,
  log: LogApi,
  signal: AbortSignal
): Promise<void> {
  // Phase 1: chromatic scale at fixed velocity
  log.append("  scale vel:100");
  log.append("  ▶ …");
  for (const midi of notes) {
    if (signal.aborted) return;
    const name = Note.fromMidi(midi);
    instrument.start({
      note: midi,
      duration: (msPerNote - 30) / 1000,
      velocity: 100,
      onStart: () => log.replaceLast(`  ▶ ${name} vel:100`),
      onEnded: () => log.replaceLast(`  ■ ${name} vel:100`),
    });
    await sleep(msPerNote, signal);
  }

  if (signal.aborted) return;

  // Phase 2: same note (lowest in range) 20 times, velocity 127 → 0
  const testMidi = notes[0];
  const testName = Note.fromMidi(testMidi);
  log.append(`  velocity test: ${testName}`);
  log.append("  ▶ …");
  for (let i = 0; i < 20; i++) {
    if (signal.aborted) return;
    const velocity = Math.round(127 * (1 - i / 19));
    instrument.start({
      note: testMidi,
      duration: (msPerNote - 30) / 1000,
      velocity,
      onStart: () => log.replaceLast(`  ▶ ${testName} vel:${velocity}`),
      onEnded: () => log.replaceLast(`  ■ ${testName} vel:${velocity}`),
    });
    await sleep(msPerNote, signal);
  }
}

async function playDrums(
  dm: DrumMachine,
  log: LogApi,
  signal: AbortSignal
): Promise<void> {
  const groups = dm.getGroupNames();
  log.append(`  Groups: ${groups.join("  ")}`);
  log.append("  ▶ …");
  for (const group of groups) {
    if (signal.aborted) return;
    const velocity = Math.floor(Math.random() * 127) + 1;
    dm.start({
      note: group,
      velocity,
      onStart: () => log.replaceLast(`  ▶ ${group} vel:${velocity}`),
      onEnded: () => log.replaceLast(`  ■ ${group} vel:${velocity}`),
    });
    await sleep(400, signal);
  }
}

// ── instrument tests ─────────────────────────────────────────────────────────

type InstrumentTest = {
  label: string;
  run: (ctx: AudioContext, log: LogApi, signal: AbortSignal) => Promise<void>;
};

const INSTRUMENT_TESTS: InstrumentTest[] = [
  {
    label: "SplendidGrandPiano",
    async run(ctx, log, signal) {
      log.append("  Loading… 0 / ?");
      const instrument = new SplendidGrandPiano(ctx, {
        onLoadProgress: makeProgressHandler(log),
      });
      try {
        await instrument.load;
        if (signal.aborted) return;
        log.append("  ready");
        await playMelody(instrument, chromaticNotes(48, 72), 200, log, signal);
      } finally {
        instrument.disconnect();
      }
    },
  },
  {
    label: "Soundfont",
    async run(ctx, log, signal) {
      const name = pick(getSoundfontNames());
      log.append(`  Preset: ${name} (MusyngKite)`);
      log.append("  Loading… 0 / ?");
      const instrument = new Soundfont(ctx, {
        instrument: name,
        onLoadProgress: makeProgressHandler(log),
      });
      try {
        await instrument.load;
        if (signal.aborted) return;
        log.append("  ready");
        await playMelody(instrument, chromaticNotes(48, 72), 200, log, signal);
      } finally {
        instrument.disconnect();
      }
    },
  },
  {
    label: "ElectricPiano",
    async run(ctx, log, signal) {
      const name = pick(getElectricPianoNames());
      log.append(`  Preset: ${name}`);
      log.append("  Loading… 0 / ?");
      const instrument = new ElectricPiano(ctx, {
        instrument: name,
        onLoadProgress: makeProgressHandler(log),
      });
      try {
        await instrument.load;
        if (signal.aborted) return;
        log.append("  ready");
        await playMelody(instrument, chromaticNotes(48, 72), 200, log, signal);
      } finally {
        instrument.disconnect();
      }
    },
  },
  {
    label: "Mallet",
    async run(ctx, log, signal) {
      const name = pick(getMalletNames());
      log.append(`  Preset: ${name}`);
      log.append("  Loading… 0 / ?");
      const instrument = new Mallet(ctx, {
        instrument: name,
        onLoadProgress: makeProgressHandler(log),
      });
      try {
        await instrument.load;
        if (signal.aborted) return;
        log.append("  ready");
        await playMelody(instrument, chromaticNotes(48, 72), 200, log, signal);
      } finally {
        instrument.disconnect();
      }
    },
  },
  {
    label: "Mellotron",
    async run(ctx, log, signal) {
      const name = pick(getMellotronNames());
      log.append(`  Preset: ${name}`);
      log.append("  Loading… 0 / ?");
      const instrument = new Mellotron(ctx, {
        instrument: name,
        onLoadProgress: makeProgressHandler(log),
      });
      try {
        await instrument.load;
        if (signal.aborted) return;
        log.append("  ready");
        await playMelody(instrument, chromaticNotes(48, 72), 200, log, signal);
      } finally {
        instrument.disconnect();
      }
    },
  },
  {
    label: "Smolken",
    async run(ctx, log, signal) {
      const name = pick(getSmolkenNames());
      log.append(`  Preset: ${name}`);
      log.append("  Loading… 0 / ?");
      const instrument = new Smolken(ctx, {
        instrument: name,
        onLoadProgress: makeProgressHandler(log),
      });
      try {
        await instrument.load;
        if (signal.aborted) return;
        log.append("  ready");
        // Double bass — lower range
        await playMelody(instrument, chromaticNotes(36, 60), 200, log, signal);
      } finally {
        instrument.disconnect();
      }
    },
  },
  {
    label: "DrumMachine",
    async run(ctx, log, signal) {
      const name = pick(getDrumMachineNames());
      log.append(`  Preset: ${name}`);
      log.append("  Loading… 0 / ?");
      const dm = new DrumMachine(ctx, {
        instrument: name,
        onLoadProgress: makeProgressHandler(log),
      });
      try {
        await dm.load;
        if (signal.aborted) return;
        log.append("  ready");
        await playDrums(dm, log, signal);
      } finally {
        dm.disconnect();
      }
    },
  },
  {
    label: "Versilian",
    async run(ctx, log, signal) {
      log.append("  Fetching instrument list…");
      const names = await getVersilianInstruments();
      if (signal.aborted) return;
      const name = pick(names);
      log.append(`  Preset: ${name}`);
      log.append("  Loading… 0 / ?");
      const instrument = new Versilian(ctx, {
        instrument: name,
        onLoadProgress: makeProgressHandler(log),
      });
      try {
        await instrument.load;
        if (signal.aborted) return;
        log.append("  ready");
        await playMelody(instrument, chromaticNotes(48, 72), 200, log, signal);
      } finally {
        instrument.disconnect();
      }
    },
  },
];

// ── runner ───────────────────────────────────────────────────────────────────

async function runAll(
  ctx: AudioContext,
  log: LogApi,
  signal: AbortSignal
): Promise<void> {
  for (const test of INSTRUMENT_TESTS) {
    if (signal.aborted) break;
    log.append(`━━━ ${test.label}`);
    const t0 = performance.now();
    try {
      await test.run(ctx, log, signal);
      if (!signal.aborted) {
        const secs = ((performance.now() - t0) / 1000).toFixed(1);
        log.append(`  ✓ done (${secs}s)`);
      }
    } catch (e: unknown) {
      log.append(`  ✗ ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (!signal.aborted) {
    log.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    log.append("All instruments tested.");
  }
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function TestPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const append = (line: string) => setLines((prev) => [...prev, line]);
  const replaceLast = (line: string) =>
    setLines((prev) => (prev.length ? [...prev.slice(0, -1), line] : [line]));

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines]);

  function toggle() {
    if (isRunning) {
      abortRef.current?.abort();
      setIsRunning(false);
    } else {
      setLines([]);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setIsRunning(true);
      const log: LogApi = { append, replaceLast };
      runAll(getAudioContext(), log, ctrl.signal).finally(() => {
        setIsRunning(false);
      });
    }
  }

  return (
    <>
      <Head>
        <title>smplr — instrument test</title>
      </Head>
      <div className="min-h-screen bg-gray-950 text-green-300 p-8 font-mono text-sm">
        <h1 className="text-base mb-4 text-green-400">smplr instrument test</h1>
        <button
          onClick={toggle}
          className="px-4 py-2 rounded bg-green-900 hover:bg-green-800 text-green-100 font-bold mb-6"
        >
          {isRunning ? "⏸ Pause" : "▶ Play"}
        </button>
        <div
          ref={logRef}
          className="overflow-y-auto h-[72vh] leading-relaxed space-y-px"
        >
          {lines.map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith("━")
                  ? "text-green-500 pt-2"
                  : line.startsWith("  ✓")
                  ? "text-green-400"
                  : line.startsWith("  ✗")
                  ? "text-red-400"
                  : line.startsWith("  ▶")
                  ? "text-yellow-300"
                  : line.startsWith("  ■")
                  ? "text-green-200"
                  : "text-green-600"
              }
            >
              {line}
            </div>
          ))}
          {isRunning && (
            <div className="text-green-700 animate-pulse select-none">▊</div>
          )}
        </div>
      </div>
    </>
  );
}
