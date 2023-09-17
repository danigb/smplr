import { findSamplesInRegions, spreadRegions } from "./layers";
import { RegionGroup, SampleRegion } from "./types";

describe("findSamplesInRegions", () => {
  it("find by rangeMidi", () => {
    const group: RegionGroup = {
      regions: [
        { sampleName: "a", midiPitch: 60, midiLow: 60, midiHigh: 75 },
        { sampleName: "b", midiPitch: 75, midiLow: 70, midiHigh: 80 },
      ],
      sample: {},
    };

    expect(findSamplesInRegions(group, { note: 60 })).toEqual([
      { name: "a", detune: 0, note: 60 },
    ]);
    expect(findSamplesInRegions(group, { note: 62 })).toEqual([
      { name: "a", detune: 200, note: 62 },
    ]);
    expect(findSamplesInRegions(group, { note: 72 })).toEqual([
      { detune: 1200, name: "a", note: 72 },
      { detune: -300, name: "b", note: 72 },
    ]);
    expect(findSamplesInRegions(group, { note: 80 })).toEqual([
      { detune: 500, name: "b", note: 80 },
    ]);
  });

  it("find by rangeVol", () => {
    const group: RegionGroup = {
      regions: [
        { sampleName: "a", midiPitch: 60, velLow: 0, velHigh: 64 },
        { sampleName: "b", midiPitch: 60, velLow: 64, velHigh: 127 },
      ],
      sample: {},
    };

    expect(findSamplesInRegions(group, { note: 60, velocity: 0 })).toEqual([
      { name: "a", detune: 0, note: 60, velocity: 0 },
    ]);
    expect(findSamplesInRegions(group, { note: 60, velocity: 64 })).toEqual([
      { detune: 0, name: "a", note: 60, velocity: 64 },
      { detune: 0, name: "b", note: 60, velocity: 64 },
    ]);
    expect(findSamplesInRegions(group, { note: 60, velocity: 127 })).toEqual([
      { name: "b", detune: 0, note: 60, velocity: 127 },
    ]);
  });

  it("keeps start time", () => {
    const group: RegionGroup = {
      regions: [{ sampleName: "a", midiPitch: 60 }],
      sample: {},
    };

    expect(
      findSamplesInRegions(group, { note: 70, velocity: 0, time: 1.5 })
    ).toEqual([{ note: 70, name: "a", detune: 1000, time: 1.5, velocity: 0 }]);
  });

  it("find by rangeMidi and rangeVol", () => {
    const group: RegionGroup = {
      regions: [
        {
          sampleName: "a",
          midiPitch: 60,
          midiLow: 60,
          midiHigh: 75,
          velLow: 0,
          velHigh: 64,
        },
        {
          sampleName: "b",
          midiPitch: 75,
          midiLow: 70,
          midiHigh: 80,
          velLow: 64,
          velHigh: 127,
        },
      ],
      sample: {},
    };

    expect(findSamplesInRegions(group, { note: 60, velocity: 0 })).toEqual([
      { name: "a", detune: 0, note: 60, velocity: 0 },
    ]);
    expect(findSamplesInRegions(group, { note: 62, velocity: 64 })).toEqual([
      { name: "a", detune: 200, note: 62, velocity: 64 },
    ]);
    expect(findSamplesInRegions(group, { note: 72, velocity: 64 })).toEqual([
      { detune: 1200, name: "a", note: 72, velocity: 64 },
      { detune: -300, name: "b", note: 72, velocity: 64 },
    ]);
    expect(findSamplesInRegions(group, { note: 72, velocity: 127 })).toEqual([
      { detune: -300, name: "b", note: 72, velocity: 127 },
    ]);
    expect(findSamplesInRegions(group, { note: 80, velocity: 127 })).toEqual([
      { detune: 500, name: "b", note: 80, velocity: 127 },
    ]);
  });

  describe("applies modifiers", () => {
    const createGroup = (region: Partial<SampleRegion>): RegionGroup => ({
      regions: [
        {
          sampleName: "a",
          midiPitch: 60,
          ...region,
        },
      ],
      sample: {},
    });
    it("applies tune", () => {
      const group = createGroup({ tune: 1 });
      expect(findSamplesInRegions(group, { note: 65, velocity: 100 })).toEqual([
        {
          detune: 600,
          name: "a",
          note: 65,
          velocity: 100,
        },
      ]);
    });
    it("applies volume", () => {
      const group = createGroup({ volume: 1 });
      expect(findSamplesInRegions(group, { note: 65, velocity: 100 })).toEqual([
        {
          detune: 500,
          name: "a",
          note: 65,
          velocity: 100,
          gainOffset: 1.1220184543019633,
        },
      ]);
    });
  });

  it("applies sample options", () => {
    const group: RegionGroup = {
      regions: [
        {
          sampleName: "a",
          midiPitch: 60,
          sample: { loopStart: 10, loopEnd: 20 },
        },
        {
          sampleName: "b",
          midiPitch: 62,
          sample: { loopStart: 10, loop: false },
        },
      ],
      sample: { loopStart: 5, loopEnd: 25, loop: true },
    };
    expect(findSamplesInRegions(group, { note: 65 })).toEqual([
      {
        name: "a",
        note: 65,
        detune: 500,
        loop: true,
        loopEnd: 20,
        loopStart: 10,
      },
      {
        name: "b",
        note: 65,
        detune: 300,
        loop: false,
        loopEnd: 25,
        loopStart: 10,
      },
    ]);
  });
});

describe("spreadRegions", () => {
  it("should correctly spread a single region", () => {
    const regions: SampleRegion[] = [
      {
        sampleName: "A",
        midiPitch: 64,
      },
    ];
    expect(spreadRegions(regions)).toEqual([
      { midiLow: 0, midiHigh: 127, midiPitch: 64, sampleName: "A" },
    ]);
  });

  it("should correctly spread two regions", () => {
    const regions: SampleRegion[] = [
      { sampleName: "A", midiPitch: 32 },
      { sampleName: "B", midiPitch: 96 },
    ];
    expect(spreadRegions(regions)).toEqual([
      { midiLow: 0, midiHigh: 64, midiPitch: 32, sampleName: "A" },
      { midiLow: 65, midiHigh: 127, midiPitch: 96, sampleName: "B" },
    ]);
  });

  it("should correctly spread three regions", () => {
    const regions: SampleRegion[] = [
      { sampleName: "A", midiPitch: 10 },
      { sampleName: "B", midiPitch: 80 },
      { sampleName: "C", midiPitch: 96 },
    ];
    expect(spreadRegions(regions)).toEqual([
      { midiLow: 0, midiHigh: 45, midiPitch: 10, sampleName: "A" },
      { midiLow: 46, midiHigh: 88, midiPitch: 80, sampleName: "B" },
      { midiLow: 89, midiHigh: 127, midiPitch: 96, sampleName: "C" },
    ]);
  });

  it("should handle empty regions", () => {
    const regions: SampleRegion[] = [];
    expect(spreadRegions(regions)).toEqual([]);
  });

  // You can add more test cases based on different scenarios.
});
