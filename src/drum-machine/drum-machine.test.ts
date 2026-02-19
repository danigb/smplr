import { createAudioContextMock, createFetchMock } from "../test-helpers";
import { DrumMachine } from "./drum-machine";

function setup() {
  createFetchMock({
    "https://smpldsnds.github.io/drum-machines/TR-808/dm.json": {
      baseUrl: "",
      name: "",
      samples: ["kick/low", "kick/mid", "kick/high"],
    },
    "https://smpldsnds.github.io/drum-machines/TR-808/kick/low.ogg": "kick-l",
    "https://smpldsnds.github.io/drum-machines/TR-808/kick/mid.ogg": "kick-m",
    "https://smpldsnds.github.io/drum-machines/TR-808/kick/high.ogg": "kick-h",
  });
  const mock = createAudioContextMock();
  const context = mock.context;

  return { context, mock };
}

describe("Drum machine", () => {
  it("starts a voice when triggered by group name alias", async () => {
    const { context, mock } = setup();
    const dm = await new DrumMachine(context, {
      instrument: "TR-808",
    }).load;

    dm.start({ note: "kick" });

    // A buffer source should have been created (voice started)
    expect(mock.bufferSources.length).toBeGreaterThan(0);
    expect(mock.bufferSources[0].startedAt).toBeDefined();
  });

  it("returns all samples", async () => {
    const { context } = setup();
    const dm = await new DrumMachine(context, {
      instrument: "TR-808",
    }).load;
    expect(dm.getSampleNames()).toEqual(["kick/low", "kick/mid", "kick/high"]);
    expect(dm.getGroupNames()).toEqual(["kick"]);
    expect(dm.getSampleNamesForGroup("kick")).toEqual([
      "kick/low",
      "kick/mid",
      "kick/high",
    ]);
  });

  it("stop does not throw", () => {
    const { context } = setup();
    const dm = new DrumMachine(context, { instrument: "TR-808" });
    expect(() => dm.stop({ stopId: "kick" })).not.toThrow();
  });

  it("has output", () => {
    const { context } = setup();
    const dm = new DrumMachine(context, { instrument: "TR-808" });
    expect(dm.output).toBeDefined();
  });
});
