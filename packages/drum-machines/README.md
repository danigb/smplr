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

- [maestro](https://github.com/danigb/samplr/tree/master/packages/drum-machines/maestro): Maestro Rhythm King MRK-2.
- [CR-78](https://github.com/danigb/samplr/tree/master/packages/drum-machines/CR-78): Roland CompuRythm CR-78

Feel free to contribute with a pull request.

## License

MIT License
