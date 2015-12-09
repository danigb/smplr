# samplr [![npm](https://img.shields.io/npm/v/samplr.svg)](https://www.npmjs.com/package/samplr)


A web audio sampler:

```js
var ac = new AudioContext()
var sampler = require('samplr')(ac)
sampler.load('@drum-machines/maestro').then(function (maestro) {
  var now = ac.currentTime
  maestro('kick').start(now)
  maestro('snare').start(now + 0.2)
})
```

## Install

Via npm: `npm i --save samplr` or grab the [browser ready file](https://raw.githubusercontent.com/danigb/samplr/master/packages/samplr/dist/samplr.min.js) (4kb) which exports `loader` as window globals.

## User guide


# License

MIT License
