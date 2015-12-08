# sample-loader [![npm](https://img.shields.io/npm/v/sample-loader.svg)](https://www.npmjs.com/package/sample-loader)

[![Samplr](https://img.shields.io/badge/samplr-instrument-32bbee.svg)](https://github.com/danigb/samplr)

A powerful and easy audio buffer loader for browser:

```js
var ac = new AudioContext()
var loader = require('sample-loader')(ac)

// a simple audio buffer player
function play(buffer) {
  var source = ac.createBufferSource()
  source.buffer = buffer
  source.connect(ac.destinaton)
  source.start(ac.currentTime)
}

// Load midi soundfont files
loader.load('@soundfont/marimba').then(function (buffers) {
  play(buffers['C4'])
})

// Load from a selection of drum machines!
loader.load('@drum-machines/maestro').then(function (buffers) {
  play(buffers['snare'])
})

// Load individual files
var kit = {snare: 'http://example.com/snare.wav', kick: 'http://example.com/kick.mp3'}
loader.load(kit).then(function (buffers) { play(buffers['snare']) })
```

# License

MIT License
