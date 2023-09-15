import { createAudioContextMock, createFetchMock } from "../test/audio-context";
import { DrumMachine } from "./drum-machine";

function setup() {
  createFetchMock({
    "https://danigb.github.io/samples/drum-machines/TR-808/dm.json": {
      baseUrl: "",
      name: "",
      samples: ["kick/low"],
      sampleNames: [],
      nameToSample: { kick: "kick/low" },
      sampleNameVariations: {},
    },
    "https://danigb.github.io/samples/drum-machines/TR-808/kick/low.ogg":
      "kick",
  });
  const context = createAudioContextMock();

  return { context };
}

describe("Drum machine", () => {
  it("replaces name with sample name", async () => {
    const { context } = setup();
    const dm = await new DrumMachine(context, {
      instrument: "TR-808",
    }).loaded();
    const start = jest.fn();

    (dm as any).player.start = start;
    dm.start({ note: "kick" });
    expect(start).toHaveBeenCalledWith({ note: "kick/low", stopId: "kick" });
  });

  it("calls underlying player on stop", () => {
    const { context } = setup();
    const dm = new DrumMachine(context, { instrument: "TR-808" });
    const stop = jest.fn();

    (dm as any).player.stop = stop;
    dm.stop({ stopId: "kick" });
    expect(stop).toHaveBeenCalledWith({ stopId: "kick" });
  });

  it("has output", () => {
    const { context } = setup();
    const dm = new DrumMachine(context, { instrument: "TR-808" });
    expect(dm.output).toBeDefined();
  });
});