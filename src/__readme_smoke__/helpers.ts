/**
 * Shared helpers for the README smoke-test harness.
 *
 * The harness defends a subset of the documented README examples — see
 * `README.md` line numbers in each test file. Examples are transcribed
 * verbatim where possible; the only mechanical rewrites are:
 *
 *   - `new AudioContext()` → `makeContext()` (jsdom has no AudioContext)
 *   - `import { X } from "smplr"` → `import { X } from "../"` (test lives inside src/)
 *
 * Network calls (`fetch`, `load-audio`) are mocked so the load promises
 * resolve immediately without hitting the wire.
 */

import { createAudioContextMock, AudioContextMock } from "../test-helpers";

// jsdom doesn't ship the Web Audio constructors; stub the ones the factory
// bodies reference for runtime `instanceof` narrowing. Setting once at module
// load is safe — every test file in this directory imports from here.
if (typeof (global as any).AudioBuffer === "undefined") {
  (global as any).AudioBuffer = class AudioBuffer {
    numberOfChannels = 0;
    length = 0;
    sampleRate = 0;
  };
}

export function makeContext(): AudioContext {
  // The mock satisfies the subset of BaseAudioContext the smplr factories use.
  return createAudioContextMock() as unknown as AudioContext;
}

export function rawMockContext(): AudioContextMock {
  return createAudioContextMock();
}

/**
 * Install a permissive global `fetch` that returns empty payloads for every
 * URL. Use this when the test only cares about the construct/extras surface,
 * not about what the load actually produces.
 */
export function stubFetch(): void {
  (global as any).fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    text: async () => "",
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0),
  });
}
