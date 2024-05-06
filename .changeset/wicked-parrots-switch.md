---
"smplr": minor
---

#### Load soundfont files directly via Soundfont2

Now is possible to load soundfont files directly thanks to [soundfont2](https://www.npmjs.com/package/soundfont2) package.

First you need to add the dependency to the project:

```bash
npm i soundfont2
```

Then, use the new Soundfont2Sampler class:

```ts
import { Soundfont2Sampler } from "smplr";
import { SoundFont2 } from "soundfont2";

const context = new AudioContext();
const sampler = Soundfont2Sampler(context, {
  url: "https://smpldsnds.github.io/soundfonts/soundfonts/galaxy-electric-pianos.sf2",
  createSoundfont: (data) => new SoundFont2(data),
});

sampler.load(() => {
  // list all available instruments for the soundfont
  console.log(sampler.instrumentNames);

  // load the first available instrument
  sampler.loadInstrument(sampler.instrumentNames[0]);
});
```

Support is still very limited. Lot of soundfont features are still not implemented, however looping seems to work quite well (read #78)
