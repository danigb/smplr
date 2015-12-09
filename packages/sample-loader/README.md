# sample-loader [![npm](https://img.shields.io/npm/v/sample-loader.svg)](https://www.npmjs.com/package/sample-loader)

[![Samplr](https://img.shields.io/badge/samplr-instrument-32bbee.svg)](https://github.com/danigb/samplr)

A powerful and easy audio buffer loader for browser:

```js
var ac = new AudioContext()

// a simple audio buffer player (use `sample-player` instead)
function play(buffer) {
  var source = ac.createBufferSource()
  source.buffer = buffer
  source.connect(ac.destinaton)
  source.start(ac.currentTime)
}

var load = require('sample-loader')(ac, null)
load('@drum-machines/maestro').then(function (buffers) {
  play(buffers['snare'])
})
```

## Features

- Load individual audio files or collection of them
- Load base64 encoded audio strings
- Compatile with midi.js soundfonts
- Ready to use instruments with no setup

## Install

Via npm: `npm i --save sample-loader` or grab the [browser ready file](https://raw.githubusercontent.com/danigb/samplr/master/packages/sample-loader/dist/sample-loader.min.js) (4kb) which exports `loader` as window globals.

## User guide

`sample-loader` is a flexible function to load samples from server. You can create a loader with an AudioContext instance and an (optional) options hash map:

```js
var loader = require('sample-loader')
var ac = new AudioContext()
var load = loader(ac, { /* options */ })
```

The returned `load` function receives only one parameter: the samples to load and returns always a Promise.

#### Load audio files

You can load individual or collection of files:

```js
load('http://path/to/file.mp3').then(function (buffer) {
  // buffer is an AudioBuffer
  play(buffer)
})

load(['samples/snare.mp3', 'samples/kick.mp3']).then(function (buffers) {
  // buffers is an array of AudioBuffers
  play(buffers[0])
})

load({ snare: 'samples/snare.mp3', kick: 'samples/kick.mp3' }).then(function (buffers) {
  // buffers is a hash of names to AudioBuffers
  play(buffers['snare'])
})
```

#### Load soundfont files

You can load [midi.js](https://github.com/mudcube/MIDI.js) soundfont files, and works out of the box with Benjamin Gleitzman's package of
[pre-rendered sound fonts](https://github.com/gleitz/midi-js-soundfonts). No server setup, just prepend `@soundfont` before the instrument name:

```js
load('@soundfont/acoustic_grand_piano').then(function(buffers) {
  play(buffers['C2'])
})
```

#### Other instruments

Can load [drum-machines](https://github.com/danigb/samplr/tree/master/packages/drum-machines) by prepending `@drum-machines` before the instrument name:

```js
load('@drum-machines/CR-78').then(function (buffers) {
  play(buffers['snare'])
})
```

#### Add instrument sources

You can add you own server samples repositories with the `options` parameter:

```js
var load = loader(ac, { repositories: {
  '@my-repo': 'http://myserver.com/samples'
}})
```

and then:

```js
load('@my-repo/file.mp3')
```


# License

MIT License
