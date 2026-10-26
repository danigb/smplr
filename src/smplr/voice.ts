import { dbToGain, midiVelToGain } from "./volume";
import { VoiceParams } from "./types";
import {
  AdsrTimes,
  EnvelopeMapping,
  adsrValueAt,
  computeAdsrTimes,
  hasAdsrShape,
  scheduleAdsr,
  scheduleAdsrRelease,
} from "./envelope";

/** A param driven by the modulation envelope, and how envelope values map onto its units. */
type ModEnvTarget = { param: AudioParam; mapping: EnvelopeMapping };

type ModEnv = {
  targets: ModEnvTarget[];
  times: AdsrTimes;
  release: number;
};

export class Voice {
  readonly stopId: string | number;
  readonly group: number | undefined;

  #context: BaseAudioContext;
  #source: AudioBufferSourceNode;
  #envelope: GainNode;
  #startAt: number;
  #releaseAt: number | undefined;
  #ampEnvTimes: AdsrTimes;
  #ampRelease: number;
  /** Amp envelope level at #releaseAt, where the release ramp starts from. */
  #releaseLevel = 0;
  #lfoOscillators: OscillatorNode[] = [];
  #modDepths: GainNode[] = [];
  #modEnv: ModEnv | undefined;
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

    const startAt = startTime ?? context.currentTime;
    this.#startAt = startAt;

    const ampEnvTimes = computeAdsrTimes(startAt, {
      delay: params.ampDelay,
      attack: params.ampAttack,
      hold: params.ampHold,
      decay: params.ampDecay,
      sustain: params.ampSustain,
    });
    this.#ampEnvTimes = ampEnvTimes;

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

    /** LPF — only inserted when cutoff is meaningfully below Nyquist, or when something modulates
     * it. Q shapes the resonant peak at the cutoff frequency; irrelevant (and
     * left at BiquadFilterNode's own default) when there's no filter to shape.
     */
    let lpf: BiquadFilterNode | undefined;
    if (
      params.lpfCutoffHz < 20000 ||
      params.modLfoToFilterFc !== 0 ||
      params.modEnvToFilterFc !== 0
    ) {
      lpf = context.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = params.lpfCutoffHz;
      lpf.Q.value = params.lpfQ;
    }

    // Velocity gain × dB volume
    const gain = context.createGain();
    gain.gain.value = midiVelToGain(params.velocity) * dbToGain(params.volume);

    // Stereo pan — only inserted when off-center
    let panner: StereoPannerNode | undefined;
    if (params.pan !== 0) {
      panner = context.createStereoPanner();
      panner.pan.value = params.pan;
    }

    /**
     * Modulation LFOs. Mod LFO can drive pitch, filter cutoff, and volume (tremolo)
     * simultaneously - one shared oscillator, one depth-gain branch per destination actually in
     * use. Vib LFO is a second, independent oscillator dedicated to pitch only (SF2 models these
     * as genuinely separate LFOs, not one LFO with a vibrato flag).
     *
     * Pitch is exact: detune is natively in cents, so an LFO's signal sums onto it with no
     * conversion. Filter/volume are linear approximations of SF2's exponential units (cents,
     * centibels) - Web Audio only sums LFO signals linearly onto frequency/gain AudioParams, so
     * depths are converted via the derivative of the exponential curve at the base value
     * (accurate for modest modulation depths, increasingly approximate for extreme sweeps).
     */
    if (
      (source.detune && params.modLfoToPitch !== 0) ||
      (lpf && params.modLfoToFilterFc !== 0) ||
      params.modLfoToVolume !== 0
    ) {
      const modLfo = this.#createLfo(
        context,
        startAt,
        params.modLfoRateHz,
        params.modLfoDelay,
      );
      if (source.detune) {
        this.#connectModDepth(
          context,
          modLfo,
          source.detune,
          params.modLfoToPitch,
        );
      }
      if (lpf) {
        // Clamped to the base cutoff so the sweep never goes below 0 Hz.
        const filterDepthHz = clampDepth(
          params.lpfCutoffHz * (Math.LN2 / 1200) * params.modLfoToFilterFc,
          params.lpfCutoffHz,
        );
        this.#connectModDepth(context, modLfo, lpf.frequency, filterDepthHz);
      }
      // Clamped to the base gain so tremolo dips at most to silence: no phase inversion, and
      // no boost beyond 2x.
      const volumeDepthLinear = clampDepth(
        gain.gain.value * (Math.LN10 / 200) * params.modLfoToVolume,
        gain.gain.value,
      );
      this.#connectModDepth(context, modLfo, gain.gain, volumeDepthLinear);
    }
    if (source.detune && params.vibLfoToPitch !== 0) {
      const vibLfo = this.#createLfo(
        context,
        startAt,
        params.vibLfoRateHz,
        params.vibLfoDelay,
      );
      this.#connectModDepth(
        context,
        vibLfo,
        source.detune,
        params.vibLfoToPitch,
      );
    }

    /**
     * Modulation envelope: a second, independent delay/attack/hold/decay/sustain/release
     * envelope (same shape as the amplitude envelope below, different generators/timing) that
     * can shape pitch and/or filter cutoff over time - e.g. a brass "pitch swoop" on attack.
     */
    const modEnvTargets: ModEnvTarget[] = [];
    if (source.detune && params.modEnvToPitch !== 0) {
      modEnvTargets.push({
        param: source.detune,
        mapping: {
          toValue: (env) => cents + params.modEnvToPitch * env,
          ramp: "linear",
        },
      });
    }
    if (lpf && params.modEnvToFilterFc !== 0) {
      const nyquist = context.sampleRate / 2;
      modEnvTargets.push({
        param: lpf.frequency,
        mapping: {
          toValue: (env) =>
            Math.min(
              nyquist,
              Math.max(
                1,
                params.lpfCutoffHz *
                  Math.pow(2, (params.modEnvToFilterFc * env) / 1200),
              ),
            ),
          ramp: "exponential",
        },
      });
    }
    if (modEnvTargets.length > 0) {
      const modEnvTimes = computeAdsrTimes(startAt, {
        delay: params.modEnvDelay,
        attack: params.modEnvAttack,
        hold: params.modEnvHold,
        decay: params.modEnvDecay,
        sustain: params.modEnvSustain,
      });
      const shaped = hasAdsrShape(startAt, modEnvTimes);
      for (const { param, mapping } of modEnvTargets) {
        if (shaped) {
          scheduleAdsr(param, startAt, modEnvTimes, mapping);
        } else {
          param.value = mapping.toValue(1);
        }
      }
      this.#modEnv = {
        targets: modEnvTargets,
        times: modEnvTimes,
        release: params.modEnvRelease,
      };
    }

    /**
     * Volume envelope: delay (silent) -> attack (0 -> 1) -> hold (flat at 1) -> decay
     * (1 -> ampSustain) -> sustain (held at ampSustain until stop()). Only scheduled when any
     * phase actually shapes the sound - the common case (every phase at its SF2 default) skips
     * AudioParam automation entirely and stays flat at 1, matching plain sample playback.
     */
    const envelope = context.createGain();
    if (hasAdsrShape(startAt, ampEnvTimes)) {
      scheduleAdsr(envelope.gain, startAt, ampEnvTimes);
    } else {
      envelope.gain.value = 1.0;
    }

    // Wire: source → [lpf] → gain → [pan] → envelope → destination
    if (lpf) {
      source.connect(lpf);
      lpf.connect(gain);
    } else {
      source.connect(gain);
    }
    if (panner) {
      gain.connect(panner);
      panner.connect(envelope);
    } else {
      gain.connect(envelope);
    }
    envelope.connect(destination);
    /**
     * Offset: VoiceParams.offset is in seconds (matches loopStart/loopEnd).
     * When playing in reverse (buffer is already reversed), mirror the offset so
     * offset=T from the start of the original buffer maps to (duration-T) in the reversed one.
     */
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
      panner?.disconnect();
      gain.disconnect();
      lpf?.disconnect();
      source.disconnect();
      // LFOs keep running (and stay referenced) until stopped - stop them with the source.
      this.#lfoOscillators.forEach((osc) => {
        osc.stop();
        osc.disconnect();
      });
      this.#modDepths.forEach((depth) => depth.disconnect());
      for (const cb of this.#endedCallbacks) cb();
      this.#endedCallbacks = [];
    };
  }

  /** Creates and starts a sine-wave LFO oscillator (delayed start, fixed rate). Not yet connected to anything. */
  #createLfo(
    context: BaseAudioContext,
    startAt: number,
    rateHz: number,
    delaySec: number,
  ): OscillatorNode {
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.value = rateHz;
    osc.start(startAt + delaySec);
    this.#lfoOscillators.push(osc);
    return osc;
  }

  /**
   * Sums an LFO oscillator's output, scaled by `depth`, onto `target`. No-op when `depth` is 0.
   */
  #connectModDepth(
    context: BaseAudioContext,
    source: AudioNode,
    target: AudioParam,
    depth: number,
  ): void {
    if (depth === 0) return;
    const depthGain = context.createGain();
    depthGain.gain.value = depth;
    source.connect(depthGain);
    depthGain.connect(target);
    this.#modDepths.push(depthGain);
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
      this.#lfoOscillators.forEach((osc) => osc.stop(t));
    } else {
      // Apply release envelope then stop the source, starting the release from wherever the
      // envelope actually was at time t - see scheduleAdsrRelease.
      this.#releaseLevel = adsrValueAt(this.#ampEnvTimes, t);
      const stopAt = scheduleAdsrRelease(
        this.#envelope.gain,
        this.#ampEnvTimes,
        t,
        this.#ampRelease,
      );
      this.#source.stop(stopAt);
      this.#lfoOscillators.forEach((osc) => osc.stop(stopAt));

      // The modulation envelope has its own, independent release time - not necessarily the
      // same as the amplitude envelope's.
      if (this.#modEnv) {
        const { targets, times, release } = this.#modEnv;
        for (const { param, mapping } of targets) {
          scheduleAdsrRelease(param, times, t, release, mapping);
        }
      }
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

    // Fade from wherever the envelope is at `time` (attack, decay, sustain or a running
    // release), so the stolen voice doesn't jump up before fading.
    const level = this.#ampLevelAt(time);

    this.#state = "stopping";
    this.#releaseAt = time;
    this.#releaseLevel = level;
    this.#ampRelease = fade;

    const stopAt = time + fade;
    // Same as scheduleAdsrRelease: cancelScheduledValues(time) drops any ramp ending after
    // `time`, so ramp (not jump) to `level` to keep the curve up to `time`.
    this.#envelope.gain.cancelScheduledValues(time);
    this.#envelope.gain.linearRampToValueAtTime(level, time);
    this.#envelope.gain.linearRampToValueAtTime(0, stopAt);
    this.#source.stop(stopAt);
    this.#lfoOscillators.forEach((osc) => osc.stop(stopAt));
  }

  /** Amp envelope level at `t`: the ADSR shape, or the linear release once it has started. */
  #ampLevelAt(t: number): number {
    const releaseAt = this.#releaseAt;
    if (releaseAt === undefined || t <= releaseAt) {
      return adsrValueAt(this.#ampEnvTimes, t);
    }
    const elapsed = t - releaseAt;
    if (elapsed >= this.#ampRelease) return 0;
    return this.#releaseLevel * (1 - elapsed / this.#ampRelease);
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

/** Limits an LFO depth to ±max, so the modulated param stays within [base - max, base + max]. */
function clampDepth(depth: number, max: number): number {
  return Math.max(-max, Math.min(max, depth));
}
