/* global AudioContext */
'use strict'

var ac = new AudioContext()
var load = require('../../sample-loader')(ac)
var sampler = require('..')(ac)

document.body.innerHTML = '<h2>sampler-instrument example</h2><h1>Marimba</h1>'

load('example/piano-lite.samples.json').then(function (samples) {
  console.log('Samples', samples)
  var marimba = sampler({name: 'marimba', samples: samples}).connect(ac.destination)
  console.log(marimba.samples(), marimba.notes())
  var now = ac.currentTime
  'C Db D D# E E# f# g ab a bb b'.split(' ').forEach(function (note, i) {
    marimba.play(now, note + '2', i * 0.4, 0.2)
  })
})
