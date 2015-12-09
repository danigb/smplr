/* global AudioContext */
var ac = new AudioContext()
var samplr = require('../')(ac)
samplr.load('@drum-machines/maestro').then(function (maestro) {
  console.log('maestro', maestro, maestro.samples())
  var now = ac.currentTime
  maestro('snare').start(now + 0.2)
  maestro('clave').start(now + 0.5).start(now + 0.9)
})
