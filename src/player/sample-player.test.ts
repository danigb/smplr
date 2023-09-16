import { createAudioContextMock } from "../test/audio-context-test-helpers";
import { SamplePlayer } from "./sample-player";

describe("SamplePlayer", () => {
  it("sample name takes preference over note", () => {
    const context = createAudioContextMock();
    const player = new SamplePlayer(context.destination, {});
    player.buffers[60] = context.createBuffer(1, 1, 44100);

    player.start({ note: 60 });
    expect((context as any).bufferSources[0].buffer).toBe(player.buffers[60]);
  });

  it("sample name takes preference over note", () => {
    const context = createAudioContextMock();
    const player = new SamplePlayer(context.destination, {});
    player.buffers[60] = context.createBuffer(1, 1, 44100);
    player.buffers["A"] = context.createBuffer(1, 1, 44100);

    player.start({ note: 60, name: "A" });
    expect(context.bufferSources[0].buffer).toBe(player.buffers["A"]);
  });
});
