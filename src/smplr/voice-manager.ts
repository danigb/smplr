import { Voice } from "./voice";

/**
 * Tracks active Voice instances and provides O(1) stop operations via Maps.
 *
 * Replaces the old broadcast-stop pattern (O(n) signal to all voices)
 * with direct Set lookups keyed by stopId and group number.
 */
export class VoiceManager {
  #voices: Set<Voice> = new Set();
  #byStopId: Map<string | number, Set<Voice>> = new Map();
  #byGroup: Map<number, Set<Voice>> = new Map();
  #maxVoices: number;

  /** @param maxVoices Cap on simultaneous voices; unlimited when omitted. */
  constructor(maxVoices?: number) {
    this.#maxVoices =
      maxVoices !== undefined && maxVoices > 0 ? maxVoices : Infinity;
  }

  /**
   * Register a voice. Indexes it by stopId and group, then auto-removes it
   * when the voice fires its onEnded callback.
   */
  add(voice: Voice): void {
    this.#voices.add(voice);

    // Index by stopId
    getOrCreate(this.#byStopId, voice.stopId).add(voice);

    // Index by group (only if the voice belongs to an exclusive group)
    if (voice.group !== undefined) {
      getOrCreate(this.#byGroup, voice.group).add(voice);
    }

    // Auto-remove when the voice's source node fires onended
    voice.onEnded(() => this.#remove(voice));

    this.#enforceCap(voice);
  }

  /**
   * Keep the voices that sound together with `newest` within the cap. Every voice whose sound
   * overlaps the new one counts, including ones that are releasing or have a stop scheduled.
   * Voices are scheduled ahead and may be added out of order, so the count is checked at each
   * moment a voice starts within the new voice's span; wherever there are too many, the
   * earliest-started ones are released at that moment (voices already releasing go first).
   */
  #enforceCap(newest: Voice): void {
    if (this.#maxVoices === Infinity) return; // no cap: skip the scan
    if (newest.endTime <= newest.startTime) return; // cancelled before it ever sounded

    const overlapping = [...this.#voices].filter(
      (v) =>
        v.endTime > v.startTime &&
        v.startTime < newest.endTime &&
        v.endTime > newest.startTime,
    );
    // Earlier moments were checked when those voices were added.
    const checkAt = new Set([newest.startTime]);
    for (const v of overlapping) {
      if (v.startTime > newest.startTime) checkAt.add(v.startTime);
    }

    const released = new Set<Voice>();
    for (const t of [...checkAt].sort((a, b) => a - b)) {
      const sounding = overlapping.filter(
        (v) => !released.has(v) && v.startTime <= t && v.endTime > t,
      );
      const victims = sounding
        .filter((v) => v.startTime < t)
        .sort(
          (a, b) =>
            Number(b.isReleasing) - Number(a.isReleasing) ||
            a.startTime - b.startTime,
        );
      for (const victim of victims.slice(
        0,
        Math.max(0, sounding.length - this.#maxVoices),
      )) {
        victim.steal(t);
        released.add(victim);
      }
    }
  }

  /** Stop all active voices. */
  stopAll(time?: number): void {
    // Snapshot before iterating — stop() may synchronously trigger onEnded
    // which removes voices from the set while we're iterating.
    for (const voice of [...this.#voices]) {
      voice.stop(time);
    }
  }

  /** Stop all voices whose stopId matches. */
  stopById(stopId: string | number, time?: number): void {
    const voices = this.#byStopId.get(stopId);
    if (!voices) return;
    for (const voice of [...voices]) {
      voice.stop(time);
    }
  }

  /** Stop all voices that belong to an exclusive group number. */
  stopGroup(group: number, time?: number): void {
    const voices = this.#byGroup.get(group);
    if (!voices) return;
    for (const voice of [...voices]) {
      voice.stop(time);
    }
  }

  /** Number of voices currently tracked (includes stopping voices not yet ended). */
  get activeCount(): number {
    return this.#voices.size;
  }

  #remove(voice: Voice): void {
    this.#voices.delete(voice);
    this.#byStopId.get(voice.stopId)?.delete(voice);
    if (voice.group !== undefined) {
      this.#byGroup.get(voice.group)?.delete(voice);
    }
  }
}

function getOrCreate<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  return set;
}
