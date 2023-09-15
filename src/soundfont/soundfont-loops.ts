import { toMidi } from "../player/midi";

export type LoopData =
  | { status: "loaded"; data: Record<number, [number, number]> }
  | { status: "not-loaded" | "loading" }
  | { status: "error"; code: number };

export function getGoldstSoundfontLoopsUrl(instrument: string, kit: string) {
  if (instrument.startsWith("http")) return undefined;
  return `https://goldst.dev/midi-js-soundfonts/${kit}/${instrument}-loop.json`;
}

/**
 *
 * @see https://github.com/goldst/midi-js-soundfonts
 * @see https://github.com/danigb/smplr/issues/23
 */
export async function fetchSoundfontLoopData(url: string): Promise<LoopData> {
  try {
    const req = await fetch(url);
    if (req.status !== 200) return { status: "error", code: req.status };

    const raw = await req.json();
    const loopData: LoopData = { status: "loaded", data: {} };
    const sampleRate = 41000; // this is sample rate from the repository samples
    Object.keys(raw).forEach((key) => {
      const midi = toMidi(key);
      if (midi) {
        const offsets = raw[key];
        loopData.data[midi] = [
          offsets[0] / sampleRate,
          offsets[1] / sampleRate,
        ];
      }
    });
    return loopData;
  } catch (err) {
    return { status: "error", code: 0 };
  }
}
