# smplr [![npm](https://img.shields.io/npm/v/smplr.svg)](https://www.npmjs.com/package/smplr)

[![Build Status](https://travis-ci.org/danigb/smplr.svg?branch=master)](https://travis-ci.org/danigb/smplr)
[![Code Climate](https://codeclimate.com/github/danigb/smplr/badges/gpa.svg)](https://codeclimate.com/github/danigb/smplr)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)
[![license](https://img.shields.io/npm/l/smplr.svg)](https://www.npmjs.com/package/smplr)
[![smplr](https://img.shields.io/badge/instrument-smplr-yellow.svg)](https://github.com/danigb/smplr)

A web audio sampler instrument. It can load and trigger audio files, map them to midi notes, apply pitch change, envelopes and filters. Treat a collection of samples as a single instrument.

__This is alpha software, use at your own risk__

## Examples

#### One note sampler

```js
var smplr = require('smplr')(ac.destination)

smplr.addSource('@server', 'http://myserver.com/samples')

smplr(midi: { 'C2-C4': { sample: '@server/uke.wav', tone: 'C2' } }.then(function (uke) {
  // play chord C9 chord
  ['C2', 'E2', 'G2', 'Bb2', 'D3'].forEach(function (note) {
    uke.play(note)
  })
})
```

#### Load sound font instrument

```js
smplr('@soundfont/marimba').then(function (marimba) {
  marimba.connect(ac.destination)
  marimba.play('Eb2')
  marimba.play('Ab5')
})
```

#### Load a drum machine

```js
smplr('@drum-machines/maestro').then(function (maestro) {
  maestro.connect(ac.destination)
  var now = ac.currentTime
  maestro.play('kick', now)
  maestro.play('snare', now + 0.2)
  maestro.play('kick', now + 0.4)
  maestro.play('snare', now + 0.6)
})
```

#### Build layers

```js
smplr.layer('@soundfont/marimba', '@soundfont/piano').then(function (inst) {
  inst.play('C4')
})
```

## Features

- Load audio files or collection them
- Play samples, change pitch.
- Load instruments. Compatible with soundfont and audio pack.


## Modules

`smplr` is a collection of modules that lives in this [monorepo](https://github.com/babel/babel/blob/master/doc/design/monorepo.md). Take a look inside [`packages`](https://github.com/danigb/smplr/tree/master/packages) directory.

### Audio loader

The [audio loader module](https://github.com/danigb/smplr/tree/master/packages/sample-loader#sample-loader-) is capable to load single files or collections. It can fetch audio from a server or a github repo, and it's compatible with the Benjamin Gleitzman's [package of pre-rendered soundfonts](https://github.com/gleitz/midi-js-soundfonts) so use midi instruments requires no setup:

```js
sampler.load('@soundfont/marimba').then(function (marimba) {
  marimba.play('c4').play('e4').play('g4')
})
```

A collection of [ready-to-use drum machines](https://github.com/danigb/smplr/tree/master/packages/drum-machines) is in progress.

### Sample player

The [sample player module](https://github.com/danigb/smplr/tree/master/packages/sample-player#sample-player-) is a simple but flexible audio player with pitch change, envelopes and filters.

### Sampler instrument

The [sampler instrument module](https://github.com/danigb/smplr/tree/master/packages/sampler-instrument#sampler-instrument-) allows to load a collection of sounds with a configuration and treat it like a single instrument.

### Audio packages

You can create samples packages in a similar fashion of npm does: create an instrument.json file and add a samples folder and pack all into a single .json file.

An [audio-pack](https://github.com/danigb/smplr/tree/master/packages/audio-pack#audio-pack-) repository with [drum machines](https://github.com/danigb/smplr/tree/master/packages/drum-machines#drum-machines-) is a work in progress.

## Install

Via npm: `npm i --save smplr` or grab the [browser ready file](https://raw.githubusercontent.com/danigb/smplr/master/packages/smplr/dist/smplr.min.js) (4kb) which exports `loader` as window globals.

## Test and examples

To run the test you have to clone this repo and then `make`

To run the examples you need browserify and beefy: `npm i -g browserify beefy`. Go to each module (for example: `cd packages/sampler-instrument`) and run the example: `beefy exaple/example.js`


# License

MIT License
