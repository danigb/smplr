import { toMidi } from "./midi";
import { SampleLayer, SampleOptions, SampleRegion, SampleStart } from "./types";
import { dbToGain } from "./volume";

export function createEmptySampleLayer(
  sample: Partial<SampleOptions> = {}
): SampleLayer {
  return { regions: [], sample };
}

export function findSamplesInLayer(
  layer: SampleLayer,
  sample: SampleStart,
  seqNumber?: number
): SampleStart[] {
  const results: SampleStart[] = [];
  const midi = toMidi(sample.note);
  if (midi === undefined) return results;

  for (const region of layer.regions) {
    const found = findSampleInRegion(
      midi,
      seqNumber ?? 0,
      sample,
      region,
      layer.sample
    );
    if (found) results.push(found);
  }
  return results;
}

export function findFirstSampleInLayer(
  layer: SampleLayer,
  sample: SampleStart,
  seqNumber?: number
): SampleStart | undefined {
  const midi = toMidi(sample.note);

  if (midi === undefined) return undefined;

  for (const region of layer.regions) {
    const found = findSampleInRegion(
      midi,
      seqNumber ?? 0,
      sample,
      region,
      layer.sample
    );
    if (found) return found;
  }
  return undefined;
}

function findSampleInRegion(
  midi: number,
  seqNum: number,
  sample: SampleStart,
  region: SampleRegion,
  defaults: Partial<SampleOptions>
): SampleStart | undefined {
  const matchMidi =
    midi >= (region.midiLow ?? 0) && midi <= (region.midiHigh ?? 127);
  if (!matchMidi) return undefined;
  const matchVelocity =
    sample.velocity === undefined ||
    (sample.velocity >= (region.velLow ?? 0) &&
      sample.velocity <= (region.velHigh ?? 127));
  if (!matchVelocity) return undefined;

  if (region.seqLength) {
    const currentSeq = seqNum % region.seqLength;
    const regionIndex = (region.seqPosition ?? 1) - 1;
    if (currentSeq !== regionIndex) return undefined;
  }

  const semitones = midi - region.midiPitch;
  const velocity = sample.velocity ?? defaults.velocity;
  const regionGainOffset = region.volume ? dbToGain(region.volume) : 0;
  const sampleGainOffset = sample.gainOffset ?? defaults.gainOffset ?? 0;
  return {
    note: midi,
    name: region.sampleName,
    detune: 100 * (semitones + (region.tune ?? 0)),
    velocity: velocity == undefined ? undefined : velocity,

    decayTime:
      sample?.decayTime ?? region.sample?.decayTime ?? defaults.decayTime,
    duration: sample?.duration ?? region.sample?.duration ?? defaults.duration,
    loop: sample?.loop ?? region.sample?.loop ?? defaults.loop,
    loopStart:
      sample?.loopStart ?? region.sample?.loopStart ?? defaults.loopStart,
    loopEnd: sample?.loopEnd ?? region.sample?.loopEnd ?? defaults.loopEnd,
    lpfCutoffHz:
      sample?.lpfCutoffHz ?? region.sample?.lpfCutoffHz ?? defaults.lpfCutoffHz,
    stopId: sample.name,
    gainOffset: sampleGainOffset + regionGainOffset || undefined,
    time: sample.time,
  };
}

export function spreadRegions(regions: SampleRegion[]) {
  if (regions.length === 0) return [];
  regions.sort((a, b) => a.midiPitch - b.midiPitch);
  regions[0].midiLow = 0;
  regions[0].midiHigh = 127;
  if (regions.length === 1) return regions;

  for (let i = 1; i < regions.length; i++) {
    const prev = regions[i - 1];
    const curr = regions[i];
    const mid = Math.floor((prev.midiPitch + curr.midiPitch) / 2);
    prev.midiHigh = mid;
    curr.midiLow = mid + 1;
  }
  regions[regions.length - 1].midiHigh = 127;

  return regions;
}
