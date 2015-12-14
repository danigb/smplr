/* global AudioContext */
'use strict'

var ac = new AudioContext()
var load = require('../../sample-loader')(ac)
var sampler = require('..')(ac)

document.body.innerHTML = '<h2>sampler-instrument example</h2><h1>Marimba</h1>(open the console)'

console.log('Loading marimba...')

//load('@soundfont/marimba').then(function (samples) {
load('examples/piano-lite.json').then(function (samples) {
  console.log('Marimba loaded!')
  var marimba = sampler({name: 'marimba', samples: samples}).connect(ac.destination)
  console.log(marimba.props)
  var now = ac.currentTime
  'C Db D D# E E# f# g ab a bb b'.split(' ').forEach(function (note, i) {
    marimba.play(note + '2', now + (i * 0.4), 0.2)
  })
})
