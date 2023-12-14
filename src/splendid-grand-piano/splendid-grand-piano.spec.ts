import { InternalPlayerMock, createAudioContextMock, createFetchMock } from "../test-helpers";
import { SplendidGrandPiano } from "../splendid-grand-piano";

function setup() {
  createFetchMock({
    "https://danigb.github.io/samples/splendid-grand-piano/PP-C3.ogg":
      "PP-C3",
    "https://danigb.github.io/samples/splendid-grand-piano/Mp-C3.ogg":
      "Mp-C3",
    "https://danigb.github.io/samples/splendid-grand-piano/Mf-C3.ogg":
      "Mf-C3",
    "https://danigb.github.io/samples/splendid-grand-piano/FF-C3.ogg":
      "FF-C3",
    "https://danigb.github.io/samples/splendid-grand-piano/FF-G3.ogg":
      "FF-G3",
  });
  const mock = createAudioContextMock();
  const context = mock.context;

  return { context, mock };
}  

describe("Splendid grand piano", () => {
  it("only specified notes are loaded", async () => {
    const { context } = setup();
    const piano = await new SplendidGrandPiano(context, {
      notesToLoad: {
        notes: [60, 67],
        velocityRange: [105, 106]
      }
    }).load;

    expect(Object.keys(piano.buffers)).toHaveLength(2);
    expect(piano.buffers).toEqual({ 'FF60': { arrayBuffer: 'FF-C3' }, 'FF67': { arrayBuffer: 'FF-G3' } });

    const start = jest.fn();

    (piano as any).player.start = start;
    piano.start({ note: 'C4', velocity: 105 });
    expect(start).toHaveBeenCalledWith({ note: 'FF60', stopId: 60, detune: 0, velocity: 105 });
  });

  it("specified notes are loaded across multiple velocity ranges when given", async () => {
    const { context } = setup();    
    const piano = await new SplendidGrandPiano(context, {
      notesToLoad: {
        notes: [60],
        velocityRange: [1, 109]
      }
    }).load;

    expect(Object.keys(piano.buffers)).toHaveLength(5);
    expect(piano.buffers).toEqual({ 
        'FF60': { arrayBuffer: 'FF-C3' },
        'MF60': { arrayBuffer: 'Mf-C3' },
        'MP60': { arrayBuffer: 'Mp-C3' },
        'PP60': { arrayBuffer: 'PP-C3' },
        'PPP60': { arrayBuffer: 'PP-C3' }
    });
  });

  it("detuning is based on loaded notes", async () => {
    const { context } = setup();
    const piano = await new SplendidGrandPiano(context, {
      notesToLoad: {
        notes: [60],
        velocityRange: [105, 106]
      }
    }).load;
    const start = jest.fn();

    (piano as any).player.start = start;
    piano.start({ note: 'C6', velocity: 105 });
    expect(start).toHaveBeenCalledWith({ note: 'FF60', stopId: 84, detune: 2400, velocity: 105 });
  });
});
