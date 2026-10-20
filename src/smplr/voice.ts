import { dbToGain, midiVelToGain } from "./volume";
import { VoiceParams } from "./types";
import {
  AdsrTimes,
  EnvelopeMapping,
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
   * Sums `source`'s output, scaled by `depth`, onto `target`. No-op when `depth` is 0. `source`
   * is either an LFO oscillator or a modulation envelope's shaper gain (both are plain AudioNode
   * outputs from this point on).
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

  get isActive(): boolean {
    return this.#state !== "stopped";
  }
}

/** Limits an LFO depth to ±max, so the modulated param stays within [base - max, base + max]. */
function clampDepth(depth: number, max: number): number {
  return Math.max(-max, Math.min(max, depth));
}
