/**
 * README compile-only smoke — renderOffline patterns (L529, L575)
 *
 * `OfflineAudioContext` is not available in jsdom, so we can't *run* these
 * blocks here. Type-checking under `tsc --noEmit` proves the documented
 * API shape still compiles — the runtime side is exercised by smplr/site/.
 *
 * This file deliberately exports nothing; `npm run test:types` picks it up
 * but it's invisible to Jest.
 */

import {
  renderOffline,
  SampleLoader,
  SplendidGrandPiano,
} from "../";

// L529: basic renderOffline pattern
async function _basicRenderOffline() {
  const result = await renderOffline(async (context) => {
    const piano = await new SplendidGrandPiano(context).load;
    piano.start({ note: "C4", time: 0, duration: 1 });
    piano.start({ note: "E4", time: 0.5, duration: 1 });
  });
  result.downloadWav("export.wav");
}

// L575: loader-reuse pattern across online + offline contexts.
async function _loaderReuse(audioContext: AudioContext) {
  const loader = new SampleLoader(audioContext);
  const piano = new SplendidGrandPiano(audioContext, { loader });
  await piano.load;

  const result = await renderOffline(async (context) => {
    const offlinePiano = await new SplendidGrandPiano(context, { loader }).load;
    offlinePiano.start({ note: "C4", time: 0, duration: 1 });
  });
  return result;
}

// Silence "unused" warnings — these are intentionally compile-only.
export const _smoke = { _basicRenderOffline, _loaderReuse };
