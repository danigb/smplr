/* global AudioContext */
'use strict'

var ac = new AudioContext()
var load = require('../../sample-loader')(ac)
var sequencer = require('step-seq')
var Sampler = require('..')

document.body.innerHTML = '<h2>sampler-instrument example</h2><h1>Drum Machine</h1>'

load('@drum-machines/maestro').then(function (maestro) {
  var drums = Sampler(ac, maestro).connect(ac.destination)
  console.log('Drums', drums.samples())
  var sequence = sequencer(ac, function (event, data, when, duration) {
    console.log('event', event, data, when, duration)
    if (data === 'x') drums.sample('clave').start(when)
  })
  console.log('start sequence')
  sequence('x..x..xx'.split('')).start()
})
