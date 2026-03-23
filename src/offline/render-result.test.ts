import { RenderResult } from "./render-result";

function makeBuffer(length = 100, sampleRate = 48000): AudioBuffer {
  return {
    numberOfChannels: 2,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (ch: number) => new Float32Array(length),
  } as unknown as AudioBuffer;
}

describe("RenderResult", () => {
  it("exposes audioBuffer, duration, and sampleRate", () => {
    const buf = makeBuffer(48000, 48000); // 1 second
    const result = new RenderResult(buf);
    expect(result.audioBuffer).toBe(buf);
    expect(result.duration).toBe(1);
    expect(result.sampleRate).toBe(48000);
  });

  it("toWav() returns a Blob with audio/wav type", () => {
    const result = new RenderResult(makeBuffer());
    const blob = result.toWav();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("audio/wav");
  });

  it("toWav16() returns a Blob with audio/wav type", () => {
    const result = new RenderResult(makeBuffer());
    const blob = result.toWav16();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("audio/wav");
  });

  it("toWav() caches the result — same Blob on second call", () => {
    const result = new RenderResult(makeBuffer());
    const first = result.toWav();
    const second = result.toWav();
    expect(first).toBe(second);
  });

  it("toWav16() caches the result — same Blob on second call", () => {
    const result = new RenderResult(makeBuffer());
    const first = result.toWav16();
    const second = result.toWav16();
    expect(first).toBe(second);
  });

  it("toWav() and toWav16() return different Blobs", () => {
    const result = new RenderResult(makeBuffer());
    expect(result.toWav()).not.toBe(result.toWav16());
  });

  it("32-bit WAV is larger than 16-bit WAV", () => {
    const result = new RenderResult(makeBuffer());
    expect(result.toWav().size).toBeGreaterThan(result.toWav16().size);
  });
});
