'use strict'

var SampleProgram = require('./sample-program')
var MidiProgram = require('./midi-program')

/**
 * Build a sample program
 *
 * @param {HashMap} buffers - a map of names to params buffers
 * @param {HashMap} options - (Optional) catalog configuration. Can be:
 *
 * - params: a hash map of audio parameters configuration
 * - midi: a hash map of midi mapping configuration
 */
module.exports = function Program (instrument) {
  if (!instrument) throw Error('Instrument is required')
  var samples = SampleProgram(instrument.samples, instrument.audio || {})
  var midi = MidiProgram(samples, instrument.midi || {})
  var keys = midi.keys().concat(midi.unusedKeys())

  return {
    keys: function () { return keys.slice() },
    get: function (k) {
      return midi.get(k) || samples.get(k)
    }
  }
}
