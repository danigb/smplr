import { findRegions } from "./sfz-regions";
import { C80 } from "./__fixtures__/cp80.websfz";
import { GRANDPIANO } from "./__fixtures__/grandpiano";
import { MEATBASS } from "./__fixtures__/meatbass";

describe("Sfz", () => {
  test("find regions with midi", () => {
    expect(findRegions(C80, { midi: 61, velocity: 100 })).toEqual([
      [
        expect.objectContaining({ group_label: "F" }),
        expect.objectContaining({ pitch_keycenter: 60 }),
      ],
    ]);
    expect(findRegions(C80, { midi: 64, velocity: 100 })).toEqual([
      [
        expect.objectContaining({ group_label: "F" }),
        expect.objectContaining({ pitch_keycenter: 65 }),
      ],
    ]);
  });

  test.skip("regions for bass instruments", () => {
    const regions = findRegions(MEATBASS, { midi: 60, velocity: 100 }).map(
      ([group, region]) => [{ ...group, regions: [] }, region]
    );
    // FIXME: Really?
    expect(regions.length).toEqual(60);
  });

  test("damper pedal", () => {
    // MIDI CC 64: Sus. Pedal on/off
    // On/off switch that controls sustain pedal. Nearly every synth will react to CC 64. (See also Sostenuto CC 66)
    // https://anotherproducer.com/online-tools-for-musicians/midi-cc-list/
    expect(findRegions(GRANDPIANO, { midi: 60, velocity: 100 }).length).toBe(1);
    expect(
      findRegions(GRANDPIANO, { midi: 60, velocity: 100, cc64: 10 }).length
    ).toBe(1);
    expect(
      findRegions(GRANDPIANO, { midi: 60, velocity: 100, cc64: 90 }).length
    ).toBe(2);
  });
});
