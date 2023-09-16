import { findSamplesInLayer, spreadRegions } from "./layers";
import { SampleLayer, SampleRegion } from "./types";

describe("findSamplesInLayer", () => {
  it("find by rangeMidi", () => {
    const layer: SampleLayer = {
      regions: [
        { sampleName: "a", sampleCenter: 60, rangeMidi: [60, 75] },
        { sampleName: "b", sampleCenter: 75, rangeMidi: [70, 80] },
      ],
      options: {},
    };

    expect(findSamplesInLayer(layer, { note: 60 })).toEqual([
      { name: "a", detune: 0, note: 60 },
    ]);
    expect(findSamplesInLayer(layer, { note: 62 })).toEqual([
      { name: "a", detune: 200, note: 62 },
    ]);
    expect(findSamplesInLayer(layer, { note: 72 })).toEqual([
      { detune: 1200, name: "a", note: 72 },
      { detune: -300, name: "b", note: 72 },
    ]);
    expect(findSamplesInLayer(layer, { note: 80 })).toEqual([
      { detune: 500, name: "b", note: 80 },
    ]);
  });

  it("find by rangeVol", () => {
    const layer: SampleLayer = {
      regions: [
        { sampleName: "a", sampleCenter: 60, rangeVol: [0, 64] },
        { sampleName: "b", sampleCenter: 60, rangeVol: [64, 127] },
      ],
      options: {},
    };

    expect(findSamplesInLayer(layer, { note: 60, velocity: 0 })).toEqual([
      { name: "a", detune: 0, note: 60, velocity: 0 },
    ]);
    expect(findSamplesInLayer(layer, { note: 60, velocity: 64 })).toEqual([
      { detune: 0, name: "a", note: 60, velocity: 64 },
      { detune: 0, name: "b", note: 60, velocity: 64 },
    ]);
    expect(findSamplesInLayer(layer, { note: 60, velocity: 127 })).toEqual([
      { name: "b", detune: 0, note: 60, velocity: 127 },
    ]);
  });

  it("find by rangeMidi and rangeVol", () => {
    const layer: SampleLayer = {
      regions: [
        {
          sampleName: "a",
          sampleCenter: 60,
          rangeMidi: [60, 75],
          rangeVol: [0, 64],
        },
        {
          sampleName: "b",
          sampleCenter: 75,
          rangeMidi: [70, 80],
          rangeVol: [64, 127],
        },
      ],
      options: {},
    };

    expect(findSamplesInLayer(layer, { note: 60, velocity: 0 })).toEqual([
      { name: "a", detune: 0, note: 60, velocity: 0 },
    ]);
    expect(findSamplesInLayer(layer, { note: 62, velocity: 64 })).toEqual([
      { name: "a", detune: 200, note: 62, velocity: 64 },
    ]);
    expect(findSamplesInLayer(layer, { note: 72, velocity: 64 })).toEqual([
      { detune: 1200, name: "a", note: 72, velocity: 64 },
      { detune: -300, name: "b", note: 72, velocity: 64 },
    ]);
    expect(findSamplesInLayer(layer, { note: 72, velocity: 127 })).toEqual([
      { detune: -300, name: "b", note: 72, velocity: 127 },
    ]);
    expect(findSamplesInLayer(layer, { note: 80, velocity: 127 })).toEqual([
      { detune: 500, name: "b", note: 80, velocity: 127 },
    ]);
  });

  it("applies offsets", () => {
    const layer: SampleLayer = {
      regions: [
        {
          sampleName: "a",
          sampleCenter: 60,
          offsetDetune: 10,
          offsetVol: -15,
        },
      ],
      options: {},
    };
    expect(findSamplesInLayer(layer, { note: 65, velocity: 100 })).toEqual([
      { detune: 510, name: "a", note: 65, velocity: 85 },
    ]);
  });
});

describe("spreadRegions", () => {
  it("should correctly spread a single region", () => {
    const regions: SampleRegion[] = [
      {
        sampleName: "A",
        sampleCenter: 64,
      },
    ];
    expect(spreadRegions(regions)).toEqual([
      { rangeMidi: [0, 127], sampleCenter: 64, sampleName: "A" },
    ]);
  });

  it("should correctly spread two regions", () => {
    const regions: SampleRegion[] = [
      { sampleName: "A", sampleCenter: 32 },
      { sampleName: "B", sampleCenter: 96 },
    ];
    expect(spreadRegions(regions)).toEqual([
      { rangeMidi: [0, 64], sampleCenter: 32, sampleName: "A" },
      { rangeMidi: [65, 127], sampleCenter: 96, sampleName: "B" },
    ]);
  });

  it("should correctly spread three regions", () => {
    const regions: SampleRegion[] = [
      { sampleName: "A", sampleCenter: 10 },
      { sampleName: "B", sampleCenter: 80 },
      { sampleName: "C", sampleCenter: 96 },
    ];
    expect(spreadRegions(regions)).toEqual([
      { rangeMidi: [0, 45], sampleCenter: 10, sampleName: "A" },
      { rangeMidi: [46, 88], sampleCenter: 80, sampleName: "B" },
      { rangeMidi: [89, 127], sampleCenter: 96, sampleName: "C" },
    ]);
  });

  it("should handle empty regions", () => {
    const regions: SampleRegion[] = [];
    expect(spreadRegions(regions)).toEqual([]);
  });

  // You can add more test cases based on different scenarios.
});
