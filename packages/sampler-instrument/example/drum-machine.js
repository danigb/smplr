/* global AudioContext */
'use strict'

var ac = new AudioContext()
var load = require('../../sample-loader')(ac)
var sequencer = require('step-seq')
var sampler = require('..')

console.log('Drum Machine sampler instrument example')

load('@drum-machines/maestro').then(function (maestro) {
  var drums = sampler(ac, maestro).connect(ac.destination)
  var sequence = sequencer(ac, function (event, data, when, duration) {
    console.log('event', event, data, when, duration)
    if (data === 'x') drums('clave').start(when)
  })
  console.log('start sequence')
  sequence('x..x..xx'.split('')).start()
})
