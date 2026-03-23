import { trimSilence } from "./trim-silence";

// In jsdom, AudioBuffer constructor is not available, so we mock it.

function makeBuffer(
  data: Float32Array[],
  sampleRate = 48000
): AudioBuffer {
  const length = data[0].length;
  const numberOfChannels = data.length;

  // Mock AudioBuffer constructor for test assertions
  const originalAudioBuffer = globalThis.AudioBuffer;
  globalThis.AudioBuffer = class MockAudioBuffer {
    numberOfChannels: number;
    length: number;
    sampleRate: number;
    duration: number;
    #channels: Float32Array[];

    constructor(opts: {
      numberOfChannels: number;
      length: number;
      sampleRate: number;
    }) {
      this.numberOfChannels = opts.numberOfChannels;
      this.length = opts.length;
      this.sampleRate = opts.sampleRate;
      this.duration = opts.length / opts.sampleRate;
      this.#channels = [];
      for (let i = 0; i < opts.numberOfChannels; i++) {
        this.#channels.push(new Float32Array(opts.length));
      }
    }

    getChannelData(ch: number): Float32Array {
      return this.#channels[ch];
    }

    copyToChannel(source: Float32Array, ch: number): void {
      this.#channels[ch].set(source);
    }
  } as unknown as typeof AudioBuffer;

  const buffer = {
    numberOfChannels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (ch: number) => data[ch],
  } as unknown as AudioBuffer;

  return buffer;
}

afterEach(() => {
  // Clean up any AudioBuffer mock
});

describe("trimSilence", () => {
  it("trims trailing silence from a buffer", () => {
    const data = new Float32Array([0.5, 0.3, 0.1, 0, 0, 0, 0, 0]);
    const buf = makeBuffer([data]);
    const trimmed = trimSilence(buf);
    expect(trimmed.length).toBe(3); // samples 0, 1, 2 are non-silent
  });

  it("returns the original buffer when there is no trailing silence", () => {
    const data = new Float32Array([0.5, 0.3, 0.1]);
    const buf = makeBuffer([data]);
    const trimmed = trimSilence(buf);
    expect(trimmed).toBe(buf); // same reference
  });

  it("handles all-silent buffer by returning minimal buffer", () => {
    const data = new Float32Array([0, 0, 0, 0]);
    const buf = makeBuffer([data]);
    const trimmed = trimSilence(buf);
    expect(trimmed.length).toBe(1);
  });

  it("uses the latest non-silent sample across all channels", () => {
    const left = new Float32Array([0.5, 0, 0, 0, 0]);
    const right = new Float32Array([0, 0, 0.2, 0, 0]);
    const buf = makeBuffer([left, right]);
    const trimmed = trimSilence(buf);
    expect(trimmed.length).toBe(3); // right channel has audio at index 2
  });

  it("treats samples below threshold as silence", () => {
    const data = new Float32Array([0.5, 0.00001, 0, 0]); // 0.00001 < 1e-4
    const buf = makeBuffer([data]);
    const trimmed = trimSilence(buf);
    expect(trimmed.length).toBe(1); // only sample 0 is above threshold
  });

  it("treats samples at threshold as silence", () => {
    const data = new Float32Array([0.5, 0.0001, 0, 0]); // 0.0001 == 1e-4
    const buf = makeBuffer([data]);
    const trimmed = trimSilence(buf);
    expect(trimmed.length).toBe(1); // threshold is >, not >=
  });

  it("treats samples above threshold as non-silent", () => {
    const data = new Float32Array([0.5, 0.0002, 0, 0]); // 0.0002 > 1e-4
    const buf = makeBuffer([data]);
    const trimmed = trimSilence(buf);
    expect(trimmed.length).toBe(2);
  });
});
