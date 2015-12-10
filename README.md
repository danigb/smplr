# smplr [![npm](https://img.shields.io/npm/v/smplr.svg)](https://www.npmjs.com/package/smplr)


A web audio sampler:

```js
var ac = new AudioContext()
var sampler = require('smplr')(ac)
sampler.load('@drum-machines/maestro').then(function (maestro) {
  var now = ac.currentTime
  maestro.play('kick', now)
  maestro.play('snare', now + 0.2)
})
```

The aim of this project is to reduce to the minimum the setup and code to play sampled sounds in web audio.

It work out of the box with Benjamin Gleitzman's [package of pre-rendered](https://github.com/gleitz/midi-js-soundfonts) sound fonts, smplr get care of load the samples from the git repository (no server setup required), and play them when ready:

```js
sampler.load('@soundfont/marimba').then(function (marimba) {
  marimba.play('c4').play('e4').play('g4')
})
```

A collection of ready-to-use drum machines is on progress (currently 2 available).


## Install

Via npm: `npm i --save smplr` or grab the [browser ready file](https://raw.githubusercontent.com/danigb/smplr/master/packages/smplr/dist/smplr.min.js) (4kb) which exports `loader` as window globals.

## Modules

This is a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md) with some npm modules. Basically a smplr is a sample-loader with a sampler-instrument:

- [![npm version](https://img.shields.io/npm/v/sample-loader.svg?style=flat-square)](https://www.npmjs.com/package/sample-loader) [sample-loader](https://github.com/danigb/smplr/tree/master/packages/sample-loader)
A simple but powerful sample loader

- [![npm version](https://img.shields.io/npm/v/sample-player.svg?style=flat-square)](https://www.npmjs.com/package/sample-player) [sample-player](https://github.com/danigb/smplr/tree/master/packages/sample-player)
A sample player with envelope control

- [![npm version](https://img.shields.io/npm/v/sampler-instrument.svg?style=flat-square)](https://www.npmjs.com/package/sampler-instrument) [sampler-instrument](https://github.com/danigb/smplr/tree/master/packages/sample-instrument)
A sampler instrument

- [![npm version](https://img.shields.io/npm/v/audio-pack.svg?style=flat-square)](https://www.npmjs.com/package/audio-pack) [audio-pack](https://github.com/danigb/smplr/tree/master/packages/audio-pack)
Package samples into a file to load them in a single request

- [![npm version](https://img.shields.io/npm/v/drum-machines.svg?style=flat-square)](https://www.npmjs.com/package/drum-machines) [drum-machines](https://github.com/danigb/smplr/tree/master/packages/drum-machines)
A collection of ready to use drum machines

# License

MIT License
