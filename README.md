# samplr

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
