/* global AudioContext */
'use strict'

var ac = new AudioContext()
var loader = require('sample-loader')(ac)
var sequencer = require('step-seq')
var sampler = require('..')

console.log('Drum Machine sampler instrument example')
var samples = {clave: 'example/maeclave.wav', snare: 'example/maesnare.wav'}
loader.load(samples).then(function (buffers) {
  console.log('samples loaded.')
  var drums = sampler(ac, { samples: buffers }).connect(ac.destination)
  var sequence = sequencer(ac, function (event, data, when, duration) {
    console.log('event', event, data, when, duration)
    if (data === 'x') drums('clave').start(when)
  })
  console.log('start sequence')
  sequence('x..x..xx'.split('')).start()
})
