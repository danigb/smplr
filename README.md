# samplr [![npm](https://img.shields.io/npm/v/samplr.svg)](https://www.npmjs.com/package/samplr)

[![Samplr](https://img.shields.io/badge/samplr-instrument-32bbee.svg)](https://github.com/danigb/samplr)

A web audio sampler instrument:

```js
var ac = new AudioContext()
var sampler = require('samplr')(ac)
sampler.load('@drum-machines/maestro').then(function (maestro) {
  var now = ac.currentTime
  maestro('kick').start(now)
  maestro('snare').start(now + 0.2)
})
```

Work in progress.

# License

MIT License
