import { sfzToPreset } from "./sfz-convert";

const options = {
  baseUrl: "https://example.com",
  pathFromSampleName: (name: string) => name.replace(/\.wav$/, ""),
};

function firstRegion(sfz: string) {
  return sfzToPreset(sfz, options).groups[0].regions[0];
}

describe("sfzToPreset velocity opcodes", () => {
  it("maps amp_veltrack percent to ampVelTrack", () => {
    const region = firstRegion("<region> sample=a.wav key=60 amp_veltrack=40");
    expect(region.ampVelTrack).toBeCloseTo(0.4);
  });

  it("clamps negative amp_veltrack to 0", () => {
    const region = firstRegion("<region> sample=a.wav key=60 amp_veltrack=-50");
    expect(region.ampVelTrack).toBe(0);
  });

  it("collects every amp_velcurve_N point, adding the default endpoints", () => {
    const region = firstRegion(
      "<region> sample=a.wav key=60 amp_velcurve_64=0.3 amp_velcurve_100=0.8",
    );
    expect(region.ampVelCurve).toEqual([
      [0, 0],
      [64 / 127, 0.3],
      [100 / 127, 0.8],
      [1, 1],
    ]);
  });

  it("keeps explicit endpoints", () => {
    const region = firstRegion(
      "<region> sample=a.wav key=60 amp_velcurve_0=0.2 amp_velcurve_127=0.9",
    );
    expect(region.ampVelCurve).toEqual([
      [0, 0.2],
      [1, 0.9],
    ]);
  });

  it("inherits velocity curves from <group> and <global>", () => {
    const preset = sfzToPreset(
      `<global> amp_veltrack=50
       <group> amp_velcurve_64=0.5
       <region> sample=a.wav key=60`,
      options,
    );
    const region = preset.groups[0].regions[0];
    expect(region.ampVelTrack).toBeCloseTo(0.5);
    expect(region.ampVelCurve).toEqual([
      [0, 0],
      [64 / 127, 0.5],
      [1, 1],
    ]);
  });

  it("leaves the fields unset when the opcodes are absent", () => {
    const region = firstRegion("<region> sample=a.wav key=60");
    expect(region.ampVelTrack).toBeUndefined();
    expect(region.ampVelCurve).toBeUndefined();
  });
});
