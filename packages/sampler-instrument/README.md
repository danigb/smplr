# sampler-instrument [![npm](https://img.shields.io/npm/v/sampler-instrument.svg)](https://www.npmjs.com/package/sampler-instrument)

[![smplr](https://img.shields.io/badge/instrument-smplr-yellow.svg)](https://github.com/danigb/smplr)

A web audio sampler instrument:

```js
var ac = new AudioContext()
var sampler = require('sampler-instrument')(ac)

var drums = sampler({
  name: 'Drum machine',
  samples: {
    'kick': ... // <- an audio buffer object
    'snare': ... // <- an audio buffer object
  }
})
drums.connect(ac.destination)
var now = ac.currentTime
drums.play('kick', now)
drums.play('snare', now + 0.5)
```

## Install

Via npm only: `npm i --save sampler-instrument`

## User Guide

The `sampler` function requires one parameter: the sampler instrument definition. Basically its a hashmap with properties.

The most important one is the `samples` hash, where you specify the audio buffers to use:

```js
sampler({ samples: { 'snare': ... , 'kick': ... }})
```

#### Use note names or midi numbers

By default, if the sample name is a note, its mapped to its equivalent midi number:

```js
var inst = sampler({ samples: { 'C4': <An audio buffer instance> } })
// all are equivalents
inst.play('C4')
inst.play(60)
inst.play('Dbb4')
```

#### Midi ranges

You can create a poor's man version of a piano by a single sample and a midi map:

```js
var piano = sampler({ samples: { 'C4', <A piano note audio buffer> },
  midi: { '1-128': { sample: 'C4', tone: 'C4' }}})
```

Then you can play any note between 1 and 128:

```js
piano.play('c2') // => play a c2 piano note
piano.play('C3') // => play a C3 piano note
```

## License

MIT License
