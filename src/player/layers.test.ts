import { findSamplesInLayer } from "./layers";
import { SampleLayer } from "./types";

describe("findSamplesInLayer", () => {
  it("find by range_midi", () => {
    const layer: SampleLayer = {
      regions: [
        { sample_name: "a", sample_center: 60, range_midi: [60, 75] },
        { sample_name: "b", sample_center: 75, range_midi: [70, 80] },
      ],
    };

    expect(findSamplesInLayer({ note: 60 }, layer)).toEqual([
      { name: "a", detune: 0, note: 60 },
    ]);
    expect(findSamplesInLayer({ note: 62 }, layer)).toEqual([
      { name: "a", detune: 200, note: 62 },
    ]);
    expect(findSamplesInLayer({ note: 72 }, layer)).toEqual([
      { detune: 1200, name: "a", note: 72 },
      { detune: -300, name: "b", note: 72 },
    ]);
    expect(findSamplesInLayer({ note: 80 }, layer)).toEqual([
      { detune: 500, name: "b", note: 80 },
    ]);
  });

  it("find by range_vol", () => {
    const layer: SampleLayer = {
      regions: [
        { sample_name: "a", sample_center: 60, range_vol: [0, 64] },
        { sample_name: "b", sample_center: 60, range_vol: [64, 127] },
      ],
    };

    expect(findSamplesInLayer({ note: 60, velocity: 0 }, layer)).toEqual([
      { name: "a", detune: 0, note: 60, velocity: 0 },
    ]);
    expect(findSamplesInLayer({ note: 60, velocity: 64 }, layer)).toEqual([
      { detune: 0, name: "a", note: 60, velocity: 64 },
      { detune: 0, name: "b", note: 60, velocity: 64 },
    ]);
    expect(findSamplesInLayer({ note: 60, velocity: 127 }, layer)).toEqual([
      { name: "b", detune: 0, note: 60, velocity: 127 },
    ]);
  });

  it("find by range_midi and range_vol", () => {
    const layer: SampleLayer = {
      regions: [
        {
          sample_name: "a",
          sample_center: 60,
          range_midi: [60, 75],
          range_vol: [0, 64],
        },
        {
          sample_name: "b",
          sample_center: 75,
          range_midi: [70, 80],
          range_vol: [64, 127],
        },
      ],
    };

    expect(findSamplesInLayer({ note: 60, velocity: 0 }, layer)).toEqual([
      { name: "a", detune: 0, note: 60, velocity: 0 },
    ]);
    expect(findSamplesInLayer({ note: 62, velocity: 64 }, layer)).toEqual([
      { name: "a", detune: 200, note: 62, velocity: 64 },
    ]);
    expect(findSamplesInLayer({ note: 72, velocity: 64 }, layer)).toEqual([
      { detune: 1200, name: "a", note: 72, velocity: 64 },
      { detune: -300, name: "b", note: 72, velocity: 64 },
    ]);
    expect(findSamplesInLayer({ note: 72, velocity: 127 }, layer)).toEqual([
      { detune: -300, name: "b", note: 72, velocity: 127 },
    ]);
    expect(findSamplesInLayer({ note: 80, velocity: 127 }, layer)).toEqual([
      { detune: 500, name: "b", note: 80, velocity: 127 },
    ]);
  });

  it("applies offsets", () => {
    const layer: SampleLayer = {
      regions: [
        {
          sample_name: "a",
          sample_center: 60,
          offset_detune: 10,
          offset_vol: -15,
        },
      ],
    };
    expect(findSamplesInLayer({ note: 65, velocity: 100 }, layer)).toEqual([
      { detune: 510, name: "a", note: 65, velocity: 85 },
    ]);
  });
});
