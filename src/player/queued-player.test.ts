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
});
