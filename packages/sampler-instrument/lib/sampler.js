'use strict'

var Instrument = require('./instrument')
var Midi = require('./midi')
var player = require('sample-player')

module.exports = function Sample (ac, properties) {
  if (arguments.length === 1) return function (p) { return Sample(ac, p) }
  var inst = Instrument(properties.samples, properties.default)
  var midi = Midi(inst, properties.midi)
  var names = midi.names().concat(midi.unused())

  var output = ac.createGain()

  return {
    connect: function (destination) { output.connect(destination) },
    names: function () { return names.slice() },
    get: function (k) {
      var sample = midi.get(k) || inst.get(k)
      if (!sample) return null
      return player(ac, sample.buffer, sample.options).connect(output)
    }
  }
}
