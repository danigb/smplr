# drum-machines [![npm](https://img.shields.io/npm/v/drum-machines.svg)](https://www.npmjs.com/package/drum-machines)

[![Samplr](https://img.shields.io/badge/samplr-instrument-32bbee.svg)](https://github.com/danigb/samplr)

A collection of drum machines:

```js
var sampler = require('samplr')
sampler.load('@drum-machines/maestro').then(function (maestro) {
  maestro('kick').start()
})
```

## Available instruments

- Maestro Rhythm King MRK-2. [Source](http://www.submodern.com/slowburn/?p=736)

## License

MIT License
