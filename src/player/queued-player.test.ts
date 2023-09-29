import { InternalPlayerMock } from "../test-helpers";
import { QueuedPlayer } from "./queued-player";

describe("QueuedPlayer", () => {
  it("passes onStart and onEnd", () => {
    const playerMock = new InternalPlayerMock();
    const onStart = jest.fn();
    const onEnded = jest.fn();
    const player = new QueuedPlayer(playerMock, {
      onStart,
      onEnded,
    });

    player.start({ note: 60 });
    expect(playerMock.lastStart).toEqual({ note: 60, onStart, onEnded });
  });

  it("composes onStart from config and sample", () => {
    const playerMock = new InternalPlayerMock();
    const onStartGlobal = jest.fn();
    const onStartSample = jest.fn();
    const player = new QueuedPlayer(playerMock, {
      onStart: onStartGlobal,
    });

    const sample = { note: 60, onStart: onStartSample };
    player.start(sample);
    playerMock.lastStart?.onStart?.(sample);
    expect(onStartGlobal).toHaveBeenCalledWith(sample);
    expect(onStartSample).toHaveBeenCalledWith(sample);
  });

  it("composes onEnded from config and sample", () => {
    const playerMock = new InternalPlayerMock();
    const onEndedGlobal = jest.fn();
    const onEndedSample = jest.fn();
    const player = new QueuedPlayer(playerMock, {
      onEnded: onEndedGlobal,
    });

    const sample = { note: 60, onEnded: onEndedSample };
    player.start(sample);
    playerMock.lastStart?.onEnded?.(sample);
    expect(onEndedGlobal).toHaveBeenCalledWith(sample);
    expect(onEndedSample).toHaveBeenCalledWith(sample);
  });
});
