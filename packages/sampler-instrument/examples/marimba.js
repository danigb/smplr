/* global AudioContext */
'use strict'

var ac = new AudioContext()
var load = require('../../sample-loader')(ac)
var sampler = require('..')(ac)

document.body.innerHTML = '<h2>sampler-instrument example</h2><h1>Marimba</h1>(open the console)'

console.log('Loading marimba...')

// load('@soundfont/marimba').then(function (samples) {
load('examples/piano-lite.json').then(function (samples) {
  console.log('Marimba loaded!', samples)
  var marimba = sampler({name: 'marimba', samples: samples})
  marimba.connect(ac.destination)
  var now = ac.currentTime
  'C Db D D# E E# f# g ab a bb b'.split(' ').forEach(function (note, i) {
    var start = now + (i * 0.4)
    marimba.get(note + '2').start(start).stop(start + 0.2)
  })
})
