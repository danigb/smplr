'use strict'

var toMidi = require('note.midi')

/**
 * Create midi mappings for an instrument
 *
 * @param {Instrument} instrument - the instrument. An instrument is an object
 * with names() and get() methods
 * @param {HashMap} options - (Optional) the midi mapping options. A hash may
 * with:
 *
 * - map: a hash map of notes or a range of notes mapped to a sample name and
 * sample playing options. For example:
 * `map: {'C2': { sample: 'c2 sound' }, 'C3-C4': { sample: 'c3 sound'}}`
 */
function midi (instrument, options) {
  options = options || {}
  var midi = {}
  var unused = []
  instrument.names().forEach(function (name) {
    var m = toMidi(name)
    if (m) midi[m] = instrument.get(name)
    else unused.push(name)
  })

  if (options.map) addMap(midi, instrument, options.map)

  return {
    unused: function () { return unused.slice() },
    names: function () { return Object.keys(midi) },
    get: function (name) { return midi[toMidi(name) || name] }
  }
}

function addMap (midi, instrument, midiMap) {
  Object.keys(midiMap).forEach(function (range) {
    var rangeOpts = midiMap[range]
    var sample = instrument.get(rangeOpts.sample)
    if (!sample) throw Error('Sample not found => ' + range + ':' + rangeOpts)
    if (range.indexOf('-') === -1) range = range + '-' + range
    var split = range.split(/\s*-\s*/)
    var min = toMidi(split[0])
    var max = toMidi(split[1])
    var tone = toMidi(rangeOpts.tone)
    for (var i = min; i <= max; i++) {
      var opts = merge(merge({}, rangeOpts), sample.options)
      delete opts.sample
      delete opts.tone
      if (tone) opts.detune = (i - tone) * 100
      midi[i] = { buffer: sample.buffer, options: opts }
    }
  })
}

function merge (dest, src) {
  Object.keys(src).forEach(function (key) {
    dest[key] = src[key]
  })
  return dest
}

module.exports = midi
