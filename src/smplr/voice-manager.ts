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
    this.#maxVoices = maxVoices !== undefined && maxVoices > 0 ? maxVoices : Infinity;
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

    this.#stealIfOverCap(voice);
  }

  /**
   * Over the cap: release the earliest-started voice that is still playing, at the new voice's
   * start time (voices are scheduled ahead, so "oldest" is by start time, not creation order).
   */
  #stealIfOverCap(newest: Voice): void {
    let playing = 0;
    let oldest: Voice | undefined;
    for (const voice of this.#voices) {
      if (!voice.isPlaying || voice.startTime > newest.startTime) continue; // only voices sounding by then
      playing += 1;
      if (voice !== newest && (!oldest || voice.startTime < oldest.startTime)) oldest = voice;
    }
    if (playing > this.#maxVoices && oldest) oldest.stop(newest.startTime);
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
