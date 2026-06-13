import { Reverb } from "./reverb";

// Records every node it is connected to / disconnected from.
class FakeNode {
  connections: any[] = [];
  connect(dest: any) {
    this.connections.push(dest);
  }
  disconnect(_dest?: any) {
    this.connections = [];
  }
}

// AudioWorkletNode instances created during a test, in creation order.
let workletNodes: FakeNode[] = [];

function makeReverbContext() {
  const addModule = jest.fn().mockResolvedValue(undefined);
  return {
    audioWorklet: { addModule },
    createGain: () => new FakeNode(),
    destination: new FakeNode(),
  } as any;
}

beforeEach(() => {
  workletNodes = [];
  (global as any).Blob = class {
    constructor(_parts: any, _opts: any) {}
  };
  (global as any).URL = {
    createObjectURL: jest.fn(() => "blob:fake"),
    revokeObjectURL: jest.fn(),
  };
  (global as any).AudioWorkletNode = class extends FakeNode {
    constructor(_ctx: any, _name: string, _opts: any) {
      super();
      workletNodes.push(this);
    }
  };
});

describe("Reverb", () => {
  it("routes correctly when connect() is called before ready() resolves", async () => {
    const ctx = makeReverbContext();
    const reverb = new Reverb(ctx);
    const custom = new FakeNode();

    // Called synchronously, before the worklet promise resolves.
    reverb.connect(custom as any);
    await reverb.ready();

    const effect = workletNodes[0];
    expect(effect.connections).toContain(custom);
    expect(effect.connections[effect.connections.length - 1]).toBe(custom);
  });

  it("adds the worklet module once per context and revokes the blob URL", async () => {
    const ctx = makeReverbContext();
    const a = new Reverb(ctx);
    const b = new Reverb(ctx);
    await Promise.all([a.ready(), b.ready()]);

    expect(ctx.audioWorklet.addModule).toHaveBeenCalledTimes(1);
    expect((global as any).URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:fake",
    );
  });
});
