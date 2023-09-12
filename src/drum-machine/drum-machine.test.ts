import { createAudioContextMock, createFetchMock } from "../test/audio-context";
import { DrumMachine } from "./drum-machine";

function setup() {
  createFetchMock({
    "https://danigb.github.io/samples/drum-machines/TR-808/dm.json": {
      baseUrl: "",
      name: "",
      samples: ["kick"],
      sampleNames: [],
      nameToSample: {},
      sampleNameVariations: {},
    },
    "https://danigb.github.io/samples/drum-machines/TR-808/kick.ogg": "kick",
  });
  const context = createAudioContextMock();

  return { context };
}

describe("Drum machine", () => {
  it("calls underlying player on start", async () => {
    const { context } = setup();
    const dm = await new DrumMachine(context, { instrument: "TR-808" });
    const start = jest.fn();

    (dm as any).player.start = start;
    dm.start({ note: "kick" });
    expect(start).toHaveBeenCalledWith({ note: "kick" });
  });

  it("calls underlying player on start", async () => {
    const { context } = setup();
    const dm = await new DrumMachine(context, { instrument: "TR-808" });
    const start = jest.fn();

    (dm as any).player.stop = start;
    dm.stop({ stopId: "kick" });
    expect(start).toHaveBeenCalledWith({ stopId: "kick" });
  });

  it("has output", () => {
    const { context } = setup();
    const dm = new DrumMachine(context, { instrument: "TR-808" });
    expect(dm.output).toBeDefined();
  });
});
