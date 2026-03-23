import { audioBufferToWav, audioBufferToWav16 } from "./wav-encoder";

function makeBuffer(
  data: Float32Array[],
  sampleRate = 48000
): AudioBuffer {
  const length = data[0].length;
  const numberOfChannels = data.length;
  const buffer = {
    numberOfChannels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (ch: number) => data[ch],
  } as unknown as AudioBuffer;
  return buffer;
}

function readHeader(blob: Blob): Promise<DataView> {
  return blob.arrayBuffer().then((ab) => new DataView(ab));
}

describe("audioBufferToWav (32-bit float)", () => {
  it("returns a Blob with audio/wav MIME type", () => {
    const buf = makeBuffer([new Float32Array([0, 0.5, -0.5, 1])]);
    const blob = audioBufferToWav(buf);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("audio/wav");
  });

  it("writes correct RIFF/WAV header", async () => {
    const buf = makeBuffer([new Float32Array(100)], 44100);
    const blob = audioBufferToWav(buf);
    const view = await readHeader(blob);

    // RIFF
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe("RIFF");
    // WAVE
    expect(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))).toBe("WAVE");
    // format = IEEE float (3)
    expect(view.getUint16(20, true)).toBe(3);
    // channels
    expect(view.getUint16(22, true)).toBe(1);
    // sample rate
    expect(view.getUint32(24, true)).toBe(44100);
    // bits per sample
    expect(view.getUint16(34, true)).toBe(32);
    // data chunk size
    expect(view.getUint32(40, true)).toBe(100 * 4);
  });

  it("writes correct sample data", async () => {
    const samples = new Float32Array([0.25, -0.5, 1.0]);
    const buf = makeBuffer([samples]);
    const blob = audioBufferToWav(buf);
    const ab = await blob.arrayBuffer();
    const view = new DataView(ab);

    expect(view.getFloat32(44, true)).toBeCloseTo(0.25);
    expect(view.getFloat32(48, true)).toBeCloseTo(-0.5);
    expect(view.getFloat32(52, true)).toBeCloseTo(1.0);
  });

  it("interleaves stereo channels", async () => {
    const left = new Float32Array([0.1, 0.2]);
    const right = new Float32Array([0.3, 0.4]);
    const buf = makeBuffer([left, right]);
    const blob = audioBufferToWav(buf);
    const ab = await blob.arrayBuffer();
    const view = new DataView(ab);

    // Interleaved: L0, R0, L1, R1
    expect(view.getFloat32(44, true)).toBeCloseTo(0.1);
    expect(view.getFloat32(48, true)).toBeCloseTo(0.3);
    expect(view.getFloat32(52, true)).toBeCloseTo(0.2);
    expect(view.getFloat32(56, true)).toBeCloseTo(0.4);
  });
});

describe("audioBufferToWav16 (16-bit integer)", () => {
  it("writes PCM format tag (1)", async () => {
    const buf = makeBuffer([new Float32Array(10)]);
    const blob = audioBufferToWav16(buf);
    const view = await readHeader(blob);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(34, true)).toBe(16);
  });

  it("clamps and scales samples to 16-bit range", async () => {
    const samples = new Float32Array([0, 1.0, -1.0, 0.5]);
    const buf = makeBuffer([samples]);
    const blob = audioBufferToWav16(buf);
    const ab = await blob.arrayBuffer();
    const view = new DataView(ab);

    expect(view.getInt16(44, true)).toBe(0);          // 0
    expect(view.getInt16(46, true)).toBe(0x7fff);     // +1.0 → 32767
    expect(view.getInt16(48, true)).toBe(-0x8000);    // -1.0 → -32768
    expect(view.getInt16(50, true)).toBeCloseTo(0x7fff * 0.5, -1); // ~16383
  });

  it("has half the data size compared to 32-bit", () => {
    const buf = makeBuffer([new Float32Array(100)]);
    const wav32 = audioBufferToWav(buf);
    const wav16 = audioBufferToWav16(buf);
    // header is 44 bytes for both
    expect(wav32.size).toBe(44 + 100 * 4);
    expect(wav16.size).toBe(44 + 100 * 2);
  });
});
