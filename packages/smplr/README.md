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

# License

MIT License
