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
    // expect(findSamplesInLayer({ note: 72 }, layer)).toEqual(undefined);
    // expect(findSamplesInLayer({ note: 80 }, layer)).toEqual(undefined);
  });
});
