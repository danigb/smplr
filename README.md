# smplr [![npm](https://img.shields.io/npm/v/smplr.svg)](https://www.npmjs.com/package/smplr)

[![Build Status](https://travis-ci.org/danigb/smplr.svg?branch=master)](https://travis-ci.org/danigb/smplr)
[![Code Climate](https://codeclimate.com/github/danigb/smplr/badges/gpa.svg)](https://codeclimate.com/github/danigb/smplr)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)
[![license](https://img.shields.io/npm/l/smplr.svg)](https://www.npmjs.com/package/smplr)
[![smplr](https://img.shields.io/badge/instrument-smplr-yellow.svg)](https://github.com/danigb/smplr)

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

It work out of the box with Benjamin Gleitzman's [package of pre-rendered](https://github.com/gleitz/midi-js-soundfonts) sound fonts, `smplr` get care of load the samples from the git repository (no server setup required), and play them when ready:

```js
sampler.load('@soundfont/marimba').then(function (marimba) {
  marimba.play('c4').play('e4').play('g4')
})
```

A collection of ready-to-use drum machines is on progress (currently 2 available).


## Install

Via npm: `npm i --save smplr` or grab the [browser ready file](https://raw.githubusercontent.com/danigb/smplr/master/packages/smplr/dist/smplr.min.js) (4kb) which exports `loader` as window globals.

## Modules

`smplr` is built from modules (basically a sampler-instrument with a sample-loader). This is a [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md) with:

- [sampler-instrument](https://github.com/danigb/smplr/tree/master/packages/sample-instrument)
A sampler instrument. Manages samples collections and preset configurations

- [sample-loader](https://github.com/danigb/smplr/tree/master/packages/sample-loader)
A simple but powerful sample loader

- [sample-player](https://github.com/danigb/smplr/tree/master/packages/sample-player)
A web audio buffer player with goodies

- [audio-pack](https://github.com/danigb/smplr/tree/master/packages/audio-pack)
An audio package utility

- [drum-machines](https://github.com/danigb/smplr/tree/master/packages/drum-machines)
A collection of ready to use drum machines

# License

MIT License
