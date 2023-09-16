function add<T>(item: T, list: T[]) {
  list.push(item);
  return item;
}

class NodeMock {
  connected: any[] = [];
  disconnected: any[] = [];

  constructor(public readonly context: AudioContextMock) {}

  connect(destination: any) {
    this.connected.push(destination);
  }

  disconnect(destination: any) {
    this.disconnected.push(destination);
  }
}

// Create a mock for the GainNodeMock
class GainNodeMock extends NodeMock {
  gain: { value: number };

  constructor(context: AudioContextMock) {
    super(context);
    this.gain = {
      value: 1.0,
    };
  }
}

class BufferSourceMock extends NodeMock {
  detune: {
    value: number;
  };
  startedAt: number | undefined;
  buffer: AudioBufferMock | undefined;

  constructor(context: AudioContextMock) {
    super(context);
    this.detune = {
      value: 0,
    };
  }

  start(time?: number) {
    if (this.startedAt !== undefined) throw new Error("Already started");
    this.startedAt = time;
  }
}

class AudioBufferMock {
  constructor(
    public numberOfChannels: number,
    public length: number,
    public sampleRate: number
  ) {}

  get buffer() {
    return this as unknown as AudioBuffer;
  }
}

class AudioContextMock {
  gains: GainNodeMock[] = [];
  bufferSources: BufferSourceMock[] = [];
  currentTime = 0;
  destination: any;

  constructor() {
    this.destination = {
      context: this,
    };
  }

  get context() {
    return this as unknown as AudioContext;
  }

  createGain() {
    return add(new GainNodeMock(this), this.gains);
  }

  decodeAudioData(arrayBuffer: any) {
    return Promise.resolve({ arrayBuffer });
  }

  createBuffer(
    numberOfChannels: number,
    length: number,
    sampleRate: number
  ): AudioBuffer {
    return new AudioBufferMock(numberOfChannels, length, sampleRate).buffer;
  }

  createBufferSource() {
    return add(new BufferSourceMock(this), this.bufferSources);
  }
}

export function createAudioContextMock() {
  (global as any).GainNode = GainNodeMock;
  (global as any).BufferSourceMock = BufferSourceMock;
  return new AudioContextMock();
}

export function createFetchMock(data: Record<string, any>) {
  const fetch = async (url: string) => {
    const value = data[url];
    if (!value) throw new Error("Url not mocked: " + url);
    return {
      status: 200,
      async json() {
        return value;
      },
      async arrayBuffer() {
        return value;
      },
    };
  };
  (global as any).fetch = fetch;
}
