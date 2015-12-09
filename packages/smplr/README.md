# smplr [![npm](https://img.shields.io/npm/v/smplr.svg)](https://www.npmjs.com/package/smplr)


A web audio sampler:

```js
var ac = new AudioContext()
var sampler = require('smplr')(ac)
sampler.load('@drum-machines/maestro').then(function (maestro) {
  var now = ac.currentTime
  maestro('kick').start(now)
  maestro('snare').start(now + 0.2)
})
```

## Install

Via npm: `npm i --save smplr` or grab the [browser ready file](https://raw.githubusercontent.com/danigb/smplr/master/packages/smplr/dist/smplr.min.js) (4kb) which exports `loader` as window globals.

## User guide


# License

MIT License
