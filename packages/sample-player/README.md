# sample-player [![npm](https://img.shields.io/npm/v/sample-player.svg)](https://www.npmjs.com/package/sample-player)

[![smplr](https://img.shields.io/badge/instrument-smplr-yellow.svg)](https://github.com/danigb/smplr)

A web audio sample player:

```js
var ac = new AudioContext()
var player = require('sample-player')(ac)
// given an snare audio into an AudioBuffer
var snare = player(audioBuffer)
var now = ac.currentTime
snare.start(now).start(now + 0.5).start(now + 1)
```

## Options

```js
{
  pitch: 0,
  loop: false,
  reverse: false,
  amp: {
    gain: 0.2
    adsr: [0.001, 0, 1, 0.1]
  },
  filter: {
    type: "lowpass"
    freq: 20
    oct: 10
    adsr: [0.001, 0.001, 1, 0.5]
  }
}
```

## Features

- Retrigger sample without re-creating nodes
- Stop all
- Detune

This is largely based on openmusic-sample-loader (but simpler, with test and some extra features: detune, events)

## Install

Via npm only: `npm i --save sample-player`

# License

MIT License
