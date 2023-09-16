import { toMidi } from "./midi";
import { SampleLayer, SampleOptions, SampleRegion, SampleStart } from "./types";

export function createEmptySampleLayer(
  options: Partial<SampleOptions> = {}
): SampleLayer {
  return { regions: [], options };
}

export function findSamplesInLayer(
  layer: SampleLayer,
  sample: SampleStart
): SampleStart[] {
  const results: SampleStart[] = [];
  const midi = toMidi(sample.note);
  if (midi === undefined) return results;

  for (const region of layer.regions) {
    const found = findSampleInRegion(midi, sample, region, layer.options);
    if (found) results.push(found);
  }
  return results;
}

export function findFirstSampleInLayer(
  layer: SampleLayer,
  sample: SampleStart
): SampleStart | undefined {
  const midi = toMidi(sample.note);

  if (midi === undefined) return undefined;

  for (const region of layer.regions) {
    const found = findSampleInRegion(midi, sample, region, layer.options);
    if (found) return found;
  }
  return undefined;
}

function findSampleInRegion(
  midi: number,
  sample: SampleStart,
  region: SampleRegion,
  defaults: Partial<SampleOptions>
): SampleStart | undefined {
  const matchMidi =
    !region.rangeMidi ||
    (midi >= region.rangeMidi[0] && midi <= region.rangeMidi[1]);
  if (!matchMidi) return undefined;
  const matchVelocity =
    sample.velocity === undefined ||
    !region.rangeVol ||
    (sample.velocity >= region.rangeVol[0] &&
      sample.velocity <= region.rangeVol[1]);
  if (!matchVelocity) return undefined;

  const semitones = midi - region.sampleCenter;
  const velocity = sample.velocity ?? defaults.velocity;
  return {
    note: midi,
    name: region.sampleName,
    detune: 100 * semitones + (region.offsetDetune ?? 0),
    velocity:
      velocity == undefined ? undefined : velocity + (region.offsetVol ?? 0),
  };
}

export function spreadRegions(regions: SampleRegion[]) {
  if (regions.length === 0) return [];
  regions.sort((a, b) => a.sampleCenter - b.sampleCenter);
  regions[0].rangeMidi = [0, 127];
  for (let i = 1; i < regions.length; i++) {
    const prev = regions[i - 1];
    const curr = regions[i];
    const mid = Math.floor((prev.sampleCenter + curr.sampleCenter) / 2);
    prev.rangeMidi![1] = mid;
    curr.rangeMidi = [mid + 1, 127];
  }
  return regions;
}
