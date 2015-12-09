/* global AudioContext */
var ac = new AudioContext()
var smplr = require('../')(ac)

smplr.load('@drum-machines/maestro').then(function (maestro) {
  console.log('maestro', maestro, maestro.samples(), maestro.notes())
  var now = ac.currentTime
  maestro.play('snare', now + 0.2)
  maestro.play('clave', now + 0.5)
  maestro.play('clave', now + 0.17)
})
