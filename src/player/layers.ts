import { toMidi } from "./midi";
import { SampleLayer, SampleOptions, SampleRegion, SampleStart } from "./types";

export function findSamplesInLayer(
  sample: SampleStart,
  layer: SampleLayer
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
  sample: SampleStart,
  layer: SampleLayer
): SampleStart | undefined {
  const midi = toMidi(sample.note);
  if (midi === undefined) return undefined;

  for (const region of layer.regions) {
    const found = findSampleInRegion(midi, sample, region, layer.options);
    return found;
  }
  return undefined;
}

function findSampleInRegion(
  midi: number,
  sample: SampleStart,
  region: SampleRegion,
  options?: Partial<SampleOptions>
): SampleStart | undefined {
  const matchMidi =
    !region.range_midi ||
    (midi >= region.range_midi[0] && midi <= region.range_midi[1]);
  if (!matchMidi) return undefined;
  const matchVelocity =
    sample.velocity === undefined ||
    !region.range_vol ||
    (sample.velocity >= region.range_vol[0] &&
      sample.velocity <= region.range_vol[1]);
  if (!matchVelocity) return undefined;

  const semitones = midi - region.sample_center;
  const velocity = sample.velocity ?? options?.velocity;
  return {
    note: midi,
    name: region.sample_name,
    detune: 100 * semitones + (region.offset_detune ?? 0),
    velocity:
      velocity == undefined ? undefined : velocity + (region.offset_vol ?? 0),
  };
}
