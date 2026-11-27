import type { NoteHandle, StopFn } from "./types";
import type { Voice } from "./voice";

type NoteOp = {
  kind: "fade" | "glide";
  value: number;
  duration: number;
  time: number;
};

/**
 * The voices created by one `start()` call, plus the operations requested before the note
 * was dispatched. The operations are replayed when the voices start.
 */
export type NoteRef = {
  voices: Set<Voice>;
  dispatched: boolean;
  ops: NoteOp[];
};

export function createNoteRef(): NoteRef {
  return { voices: new Set(), dispatched: false, ops: [] };
}

/** Register a voice created for this note. It is forgotten when it ends. */
export function addNoteVoice(ref: NoteRef, voice: Voice): void {
  ref.voices.add(voice);
  voice.onEnded(() => ref.voices.delete(voice));
}

/** Mark the note as dispatched and apply the operations queued before it started. */
export function dispatchNote(ref: NoteRef): void {
  ref.dispatched = true;
  for (const op of ref.ops) applyOp(ref, op);
  ref.ops = [];
}

function applyOp(ref: NoteRef, op: NoteOp): void {
  for (const voice of ref.voices) {
    if (op.kind === "fade") voice.fadeTo(op.value, op.duration, op.time);
    else voice.glideTo(op.value, op.duration, op.time);
  }
}

/**
 * Build the callable handle returned by `start()`. `stop` keeps the existing stop
 * semantics; `now` resolves a missing `time` at call time.
 */
export function createNoteHandle(
  ref: NoteRef,
  stop: StopFn,
  stopId: string | number,
  now: () => number,
): NoteHandle {
  const request = (op: NoteOp) => {
    if (ref.dispatched) applyOp(ref, op);
    else ref.ops.push(op);
  };

  const fn = (time?: number) => stop(time);
  // Object.assign would copy the getter's current value, so define it directly.
  Object.defineProperty(fn, "voiceCount", { get: () => ref.voices.size });
  const handle = Object.assign(fn, {
    stopId,
    stop: (time?: number) => stop(time),
    fadeTo(db: number, duration: number, time?: number) {
      request({ kind: "fade", value: db, duration, time: time ?? now() });
      return handle;
    },
    glideTo(semitones: number, duration: number, time?: number) {
      request({ kind: "glide", value: semitones, duration, time: time ?? now() });
      return handle;
    },
  }) as NoteHandle;
  return handle;
}
