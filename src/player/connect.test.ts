import { createAudioContextMock } from "../test/audio-context-test-helpers";
import { connectSerial } from "./connect";

describe("connect", () => {
  it("connects nodes in serial", () => {
    const context = createAudioContextMock().context;

    const node1 = context.createGain();
    const node2 = context.createGain();
    const node3 = context.createGain();

    connectSerial([node1, node2, node3]);
    expect((node1 as any).connected).toEqual([node2]);
    expect((node2 as any).connected).toEqual([node3]);
    expect((node3 as any).connected).toEqual([]);
  });

  it("it disconnects nodes", () => {
    const context = createAudioContextMock().context;

    const node1 = context.createGain();
    const node2 = context.createGain();
    const node3 = context.createGain();

    const disconnect = connectSerial([node1, node2, node3]);
    expect(disconnect).toBeDefined();
    expect((node1 as any).disconnected).toEqual([]);
    expect((node2 as any).disconnected).toEqual([]);
    expect((node3 as any).disconnected).toEqual([]);

    disconnect();
    expect((node1 as any).disconnected).toEqual([node2]);
    expect((node2 as any).disconnected).toEqual([node3]);
    expect((node3 as any).disconnected).toEqual([]);
  });
});
