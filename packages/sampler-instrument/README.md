# sampler-instrument [![npm](https://img.shields.io/npm/v/sampler-instrument.svg)](https://www.npmjs.com/package/sampler-instrument)

[![Samplr](https://img.shields.io/badge/samplr-instrument-32bbee.svg)](https://github.com/danigb/samplr)

A web audio sampler instrument:

```js
var sampler = require('sampler-instrument')

var ac = new AudioContext()
var drums = sampler(ac, {
  name: 'Drum machine',
  samples: {
    'kick': ... // <- an audio buffer object
    'snare': ... // <- an audio buffer object
  }
})
drums.connect(ac.destination)
var now = ac.currentTime
drums('kick').start(now)
drums('snare').start(now + 0.5)
```

# License

MIT License
