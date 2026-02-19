/**
 * Given a list of [midi, sampleName] pairs, return one entry per sample with
 * a keyRange that covers all MIDI notes closer to that sample than to any
 * neighbour. The first sample extends down to 0; the last extends up to 127.
 *
 * The boundary between two adjacent samples A and B (A < B) is placed at
 * `floor((A + B) / 2)`, matching the behaviour of the old `findNearestMidiInLayer`
 * which always resolved ties in favour of the lower sample.
 */
export type SpreadResult = {
  keyRange: [number, number];
  pitch: number;
  sample: string;
};

export function spreadKeyRanges(samples: [number, string][]): SpreadResult[] {
  if (samples.length === 0) return [];

  // Work on a sorted copy — caller order doesn't matter
  const sorted = [...samples].sort(([a], [b]) => a - b);

  return sorted.map(([midi, name], i) => {
    const low =
      i === 0
        ? 0
        : Math.floor((sorted[i - 1][0] + midi) / 2) + 1;

    const high =
      i === sorted.length - 1
        ? 127
        : Math.floor((midi + sorted[i + 1][0]) / 2);

    return { keyRange: [low, high] as [number, number], pitch: midi, sample: name };
  });
}
