import { AudioBuffers } from "../player/load-audio";
import { InternalPlayer, SampleStart, SampleStop } from "../player/types";
import { AudioContextMock, createAudioContextMock } from "./audio-context-mock";

export class InternalPlayerMock implements InternalPlayer {
  buffers: AudioBuffers;
  context: BaseAudioContext;
  contextMock: AudioContextMock;
  lastStart: SampleStart | undefined;
  lastStop: SampleStop | undefined;
  discconnected = false;

  constructor() {
    this.contextMock = createAudioContextMock();
    this.context = this.contextMock.context;
    this.buffers = {};
  }

  start(sample: SampleStart): (time?: number | undefined) => void {
    this.lastStart = sample;
    return () => undefined;
  }
  stop(sample?: SampleStop | undefined): void {
    this.lastStop = sample;
  }
  disconnect(): void {
    this.discconnected = true;
  }
}
