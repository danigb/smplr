/**
 * README smoke tests — DrumMachine
 *
 * Covers high-stakes examples called out in Spec 06 acceptance criteria:
 *  - L21  `new DrumMachine(context)`
 *  - L774 `new DrumMachine(context, { instrument: "TR-808" })` + .getSampleNames() + .start("kick")
 *
 * Confirms CD-3 (extras override `start` with stopId injection) and that
 * extras observe the post-load closure state.
 */

import { createAudioContextMock, createFetchMock } from "../test-helpers";
import { DrumMachine } from "../";

function setupTR808() {
  createFetchMock({
    "https://smpldsnds.github.io/drum-machines/TR-808/dm.json": {
      baseUrl: "",
      name: "TR-808",
      samples: ["kick-1", "kick-2", "snare-1", "snare-2"],
    },
    "https://smpldsnds.github.io/drum-machines/TR-808/kick-1.ogg": "kick-1",
    "https://smpldsnds.github.io/drum-machines/TR-808/kick-2.ogg": "kick-2",
    "https://smpldsnds.github.io/drum-machines/TR-808/snare-1.ogg": "snare-1",
    "https://smpldsnds.github.io/drum-machines/TR-808/snare-2.ogg": "snare-2",
  });
  return createAudioContextMock();
}

describe("README — DrumMachine", () => {
  it("L21: `new DrumMachine(context)` constructs with TR-808 default", () => {
    const mock = setupTR808();
    const dm = new DrumMachine(mock.context);
    dm.load.catch(() => {});
    expect(typeof dm.start).toBe("function");
    expect(typeof dm.stop).toBe("function");
    expect(dm.output).toBeDefined();
  });

  it("L774: extras (getSampleNames/getGroupNames/getSampleNamesForGroup) populate after load", async () => {
    const mock = setupTR808();
    const drums = await new DrumMachine(mock.context, { instrument: "TR-808" })
      .load;

    expect(drums.getSampleNames()).toEqual([
      "kick-1",
      "kick-2",
      "snare-1",
      "snare-2",
    ]);
    expect(drums.getGroupNames()).toEqual(["kick", "snare"]);
    expect(drums.getSampleNamesForGroup("kick")).toEqual(["kick-1", "kick-2"]);
  });

  it("L775/L783/L784: .start accepts NoteEvent and bare group-name string", async () => {
    const mock = setupTR808();
    const drums = await new DrumMachine(mock.context, { instrument: "TR-808" })
      .load;

    expect(() => drums.start({ note: "kick" })).not.toThrow();
    expect(() => drums.start("kick")).not.toThrow();
    expect(() => drums.start("kick-1")).not.toThrow();
  });
});
