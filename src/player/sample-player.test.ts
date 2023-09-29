import { createAudioContextMock } from "../test-helpers";
import { SamplePlayer } from "./sample-player";

describe("SamplePlayer", () => {
  it("note name can be a midi note", () => {
    const contextMock = createAudioContextMock();
    const player = new SamplePlayer(contextMock.context, {});
    player.buffers[60] = contextMock.createBuffer(1, 1, 44100);

    player.start({ note: 60 });
    expect((contextMock as any).bufferSources[0].buffer).toBe(
      player.buffers[60]
    );
  });

  it("sample name takes preference over note", () => {
    const contextMock = createAudioContextMock();
    const player = new SamplePlayer(contextMock.context, {});
    player.buffers[60] = contextMock.createBuffer(1, 1, 44100);
    player.buffers["A"] = contextMock.createBuffer(1, 1, 44100);

    player.start({ note: 60, name: "A" });
    expect(contextMock.bufferSources[0].buffer).toBe(player.buffers["A"]);
  });

  it("calls onStart", () => {
    const contextMock = createAudioContextMock();
    const player = new SamplePlayer(contextMock.context, {});
    player.buffers["A"] = contextMock.createBuffer(1, 1, 44100);
    const onStart = jest.fn();
    player.start({ note: 60, name: "A", onStart });
    expect(onStart).toHaveBeenCalledWith({ note: 60, name: "A", onStart });
  });
});
