/**
 * SFZ-based instruments (Mallet, Mellotron, Smolken, Versilian) — construction.
 *
 * (Rescued from the former README smoke harness: the only tests that exercise
 * these four factories. They share the SFZ region machinery — which is covered
 * elsewhere — so this just guards that each factory constructs a playable
 * instrument from its documented `{ instrument }` option.)
 */

import { Mallet, getMalletNames } from "./mallet";
import { Mellotron, getMellotronNames } from "./mellotron";
import { Smolken, getSmolkenNames } from "./smolken";
import { Versilian } from "./versilian";
import { createAudioContextMock } from "./test-helpers";

function makeContext(): AudioContext {
  return createAudioContextMock().context;
}

function stubFetch(): void {
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => "",
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0),
  });
}

describe("SFZ instruments — construction", () => {
  beforeEach(stubFetch);

  it("Mallet constructs from `{ instrument }`", () => {
    const mallet = Mallet(makeContext(), { instrument: getMalletNames()[0] });
    mallet.ready.catch(() => {});
    expect(typeof mallet.start).toBe("function");
    expect(typeof mallet.stop).toBe("function");
  });

  it("Mellotron constructs from `{ instrument }`", () => {
    const mellotron = Mellotron(makeContext(), {
      instrument: getMellotronNames()[0],
    });
    mellotron.ready.catch(() => {});
    expect(typeof mellotron.start).toBe("function");
  });

  it("Smolken constructs from `{ instrument }` and exposes `ready` as a Promise", () => {
    expect(getSmolkenNames()).toEqual(expect.arrayContaining(["Arco"]));
    const smolken = Smolken(makeContext(), { instrument: "Arco" });
    smolken.ready.catch(() => {});
    expect(typeof smolken.start).toBe("function");
    expect(smolken.ready).toBeInstanceOf(Promise);
  });

  it("Versilian constructs from `{ instrument }`", () => {
    const versilian = Versilian(makeContext(), {
      instrument: "Strings/Violin/Violin - Arco",
    });
    versilian.ready.catch(() => {});
    expect(typeof versilian.start).toBe("function");
  });
});
