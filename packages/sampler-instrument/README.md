# sampler-instrument [![npm](https://img.shields.io/npm/v/sampler-instrument.svg)](https://www.npmjs.com/package/sampler-instrument)

[![Samplr](https://img.shields.io/badge/samplr-instrument-32bbee.svg)](https://github.com/danigb/samplr)

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

Not yet. Meanwhile read API.md

## License

MIT License
