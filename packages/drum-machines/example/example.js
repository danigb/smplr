/* global AudioContext */
'use strict'
var ac = new AudioContext()

var load = require('../../sample-loader')(ac, null)
var play = require('../../sample-player')(ac)
var all = require('../drum-machines.json')

document.body.innerHTML = '<h1>Drum machines:</h1>'
all.forEach(function (name) {
  var a = document.createElement('a')
  a.innerHTML = name + ' /&nbsp;'
  a.href = '#'
  a.onclick = function () { test(name) }
  document.body.appendChild(a)
})

function test (name) {
  console.log('loading ', name)
  load('@drum-machines/' + name).then(function (cr78) {
    var samples = Object.keys(cr78.samples)
    var now = ac.currentTime
    samples.forEach(function (name, i) {
      console.log('play', name)
      play(cr78.samples[name]).connect(ac.destination).start(now + i * 0.4)
    })
  })
}
