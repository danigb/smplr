// Create a mock for the GainNodeMock
class GainNodeMock {
  gain: { value: number };
  constructor(public readonly context: AudioContextMock) {
    // You can add any necessary methods or properties here if needed
    this.gain = {
      value: 1.0, // Mock the gain value
    };
  }

  // Mock any methods you need to use in your tests
  connect(destination: any) {
    // Implement mock behavior here
  }
}

function add<T>(item: T, list: T[]) {
  list.push(item);
  return item;
}

class AudioContextMock {
  gains: GainNodeMock[] = [];
  currentTime = 0;
  destination: any;

  constructor() {
    this.destination = {
      context: this,
    };
  }

  createGain() {
    return add(new GainNodeMock(this), this.gains);
  }

  decodeAudioData(arrayBuffer: any) {
    return Promise.resolve({ arrayBuffer });
  }
}

export function createAudioContextMock() {
  (global as any).GainNode = GainNodeMock;
  return new AudioContextMock() as unknown as AudioContext;
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