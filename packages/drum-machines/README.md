# drum-machines [![npm](https://img.shields.io/npm/v/drum-machines.svg)](https://www.npmjs.com/package/drum-machines)

[![smplr](https://img.shields.io/badge/instrument-smplr-yellow.svg)](https://github.com/danigb/smplr)

A collection of drum machines:

```js
var sampler = require('smplr')
sampler.load('@drum-machines/maestro').then(function (maestro) {
  maestro('kick').start()
})
```

## Available instruments

- [MRK-2](https://github.com/danigb/smplr/tree/master/packages/drum-machines/MRK-2): Maestro Rhythm King MRK-2.
- [CR-78](https://github.com/danigb/smplr/tree/master/packages/drum-machines/CR-78): Roland CompuRythm CR-78
- [TR-505](https://github.com/danigb/smplr/tree/master/packages/drum-machines/TR-505): Roland TR-505
- [CR-78](https://github.com/danigb/smplr/tree/master/packages/drum-machines/CR-78): Roland CompuRythm CR-78

## Contribute with a drum machine

To contribute to this project you have to:

- Fork this repository
- Create a directory with the name of the drum machine
- Create a instrument.json file with drum machine information
- Create a subdirectory called samples with the audio files
- run `npm i -g audio-pack` and `audiopack path/to/instrument.json`
- run the example to test the sounds: `beefy example/example.js`
- Make a pull request

## Drum machines sample naming conventions

The samples audio files must be named: `inst-variation.ext` where `inst` is the instrument name and `variation` is optional. For example: `snare.wav`, `hihat-open.wav` and `hihat-closed.wav` are valid names. Variations can be nested: `hihat-open-h.wav`

#### Using letters to create variations

The letters `m`, `l` and `h` means mid, lower and higher. `snare-l.wav` it should be a lower snare than `snare-m.wav` and `snare-ll.wav` should be even lower.

#### Using numbers to create variations

You can use numbers padding by 2. `snare-01.wav` is valid, but `snare-1.wav` is not. Anyway, more descriptive variations are preferred: `guiro-long.wav` and `guiro-short.wav` vs. `guiro-01.wav` and `guiro-02.wav`

## Recommended instrument names

Try to name the sample with one of this names, if possible:

- __snare__
- __rim__ (rimshot, sidesticks)
- __hihat__ (variations: `hihat-open`, `hihat-closed`)
- __kick__
- __tom__
- __crash__
- __cymball__
- __clap__
- __bongo__
- __conga__
- __tamb__ (tambourine)
- __block__
- __cowbell__
- __timbal__
- __cabasa__
- __guiro__
- __clave__

## License

MIT License
