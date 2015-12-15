/* global AudioContext */
'use strict'

var ac = new AudioContext()
var load = require('../../sample-loader')(ac)
var sampler = require('..')(ac)

document.body.innerHTML = '<h2>sampler-instrument example</h2><h1>Midi ranges</h1>(open the dev console)'

console.log('Loading sample...')
load('examples/uke.wav').then(function (sample) {
  console.log('Sample loaded')
  var kalimba = sampler({name: 'kalimba', samples: {'uke': sample},
    midi: {map: {'1-127': { sample: 'uke', tone: 'c2' }}}})
  kalimba.connect(ac.destination)
  var now = ac.currentTime
  'C Db D D# E E# f# g ab a bb b'.split(' ').forEach(function (note, i) {
    kalimba.get(note + '2').start(now + (i * 0.4))
  })
})
