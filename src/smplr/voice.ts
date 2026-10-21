import { dbToGain, midiVelToGain } from "./volume";
import { VoiceParams } from "./types";

export class Voice {
  readonly stopId: string | number;
  readonly group: number | undefined;

  #context: BaseAudioContext;
  #source: AudioBufferSourceNode;
  #envelope: GainNode;
  #startAt: number;
  #releaseAt: number | undefined;
  #ampRelease: number;
  #state: "playing" | "stopping" | "stopped" = "playing";
  #endedCallbacks: (() => void)[] = [];

  constructor(
    context: BaseAudioContext,
    buffer: AudioBuffer,
    params: VoiceParams,
    destination: AudioNode,
    stopId: string | number,
    group?: number,
    startTime?: number,
  ) {
    this.#context = context;
    this.stopId = stopId;
    this.group = group;
    this.#ampRelease = params.ampRelease;

    // --- Build audio graph ---

    const source = context.createBufferSource();
    source.buffer = buffer;

    // Detune — Safari workaround: source.detune may not exist
    const cents = params.detune;
    if (source.detune) {
      source.detune.value = cents;
    } else {
      source.playbackRate.value = Math.pow(2, cents / 1200);
    }

    // Looping
    if (params.loopAuto) {
      source.loop = true;
      source.loopStart = buffer.duration * params.loopAuto.startRatio;
      source.loopEnd = buffer.duration * params.loopAuto.endRatio;
    } else if (params.loop) {
      source.loop = true;
      source.loopStart = params.loopStart;
      source.loopEnd = params.loopEnd || buffer.duration;
    }

    // LPF — only inserted when cutoff is meaningfully below Nyquist
    let lpf: BiquadFilterNode | undefined;
    if (params.lpfCutoffHz < 20000) {
      lpf = context.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = params.lpfCutoffHz;
    }

    // Velocity gain × dB volume
    const gain = context.createGain();
    gain.gain.value = midiVelToGain(params.velocity) * dbToGain(params.volume);

    // Release envelope
    const envelope = context.createGain();
    envelope.gain.value = 1.0;

    // Wire: source → [lpf] → gain → envelope → destination
    if (lpf) {
      source.connect(lpf);
      lpf.connect(gain);
    } else {
      source.connect(gain);
    }
    gain.connect(envelope);
    envelope.connect(destination);

    // Start
    const startAt = startTime ?? context.currentTime;
    this.#startAt = startAt;

    // Offset: VoiceParams.offset is in seconds (matches loopStart/loopEnd).
    // When playing in reverse (buffer is already reversed), mirror the offset so
    // offset=T from the start of the original buffer maps to (duration-T) in the reversed one.
    let offsetSec = 0;
    if (params.offset > 0) {
      offsetSec = params.reverse
        ? buffer.duration - params.offset
        : params.offset;
    }
    source.start(startAt, offsetSec);

    this.#source = source;
    this.#envelope = envelope;

    // Cleanup when the source naturally ends or is stopped
    source.onended = () => {
      this.#state = "stopped";
      envelope.disconnect();
      gain.disconnect();
      lpf?.disconnect();
      source.disconnect();
      for (const cb of this.#endedCallbacks) cb();
      this.#endedCallbacks = [];
    };
  }

  /**
   * Stop the voice, applying a release envelope if time is after the start time.
   * On subsequent calls, allows stopping at an earlier time than previously requested (e.g.
   * to immediately stop a currently playing voice).
   */
  stop(time?: number): void {
    if (this.#state === "stopped") return;

    const t = time ?? this.#context.currentTime;

    // If a stop request was already received for an earlier time, ignore.
    if (this.#releaseAt !== undefined && t >= this.#releaseAt) return;

    this.#state = "stopping";
    this.#releaseAt = t;

    if (t <= this.#startAt) {
      // Stop at or before start: cancel the note entirely
      this.#source.stop(t);
      this.#envelope.gain.cancelScheduledValues(t);
    } else {
      // Apply release envelope then stop the source
      const stopAt = t + this.#ampRelease;
      this.#envelope.gain.cancelScheduledValues(t);
      this.#envelope.gain.setValueAtTime(1.0, t);
      this.#envelope.gain.linearRampToValueAtTime(0, stopAt);
      this.#source.stop(stopAt);
    }
  }

  /**
   * Fade out quickly from `time`, even if a (longer) release is already running. Used when the
   * voice cap needs this voice gone: `stop()` ignores a later time than the one already
   * requested, so it can't shorten a release in progress. No-op if the voice already ends
   * within `fade` seconds of `time`.
   */
  steal(time: number, fade = 0.01): void {
    if (this.#state === "stopped") return;
    if (this.endTime <= time + fade) return;

    // Before it sounds: cancel it entirely, same as stop()
    if (time <= this.#startAt) return this.stop(time);

    // Where the envelope is at `time`: flat until the release starts, then falling linearly.
    const releaseAt = this.#releaseAt;
    const level =
      releaseAt === undefined || time <= releaseAt
        ? 1.0
        : Math.max(0, 1 - (time - releaseAt) / this.#ampRelease);

    this.#state = "stopping";
    this.#releaseAt = time;
    this.#ampRelease = fade;

    const stopAt = time + fade;
    this.#envelope.gain.cancelScheduledValues(time);
    this.#envelope.gain.setValueAtTime(level, time);
    this.#envelope.gain.linearRampToValueAtTime(0, stopAt);
    this.#source.stop(stopAt);
  }

  /**
   * Register a callback to be called when the source node fires its onended event.
   * If the voice has already stopped, the callback is invoked immediately.
   */
  onEnded(cb: () => void): void {
    if (this.#state === "stopped") {
      cb();
    } else {
      this.#endedCallbacks.push(cb);
    }
  }

  /** Audio-context time the voice starts (or started) sounding. */
  get startTime(): number {
    return this.#startAt;
  }

  /**
   * Audio-context time the voice stops being audible: `Infinity` until a stop is requested
   * (even one scheduled for later), then the end of its release - or its start time, if it
   * was cancelled before it ever sounded.
   */
  get endTime(): number {
    if (this.#releaseAt === undefined) return Infinity;
    if (this.#releaseAt <= this.#startAt) return this.#startAt;
    return this.#releaseAt + this.#ampRelease;
  }

  /** True once a stop has been requested: the voice is fading out. */
  get isReleasing(): boolean {
    return this.#releaseAt !== undefined;
  }

  get isActive(): boolean {
    return this.#state !== "stopped";
  }
}
