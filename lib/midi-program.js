'use strict'

var toMidi = require('note-midi')

/**
 * Create midi mappings for a sample program
 *
 * @param {Program} program - the sample program
 * @param {HashMap} options - (Optional) the midi mapping options. A hash may
 * with:
 *
 * - auto: set to false if you don't want automatic midi mappings using the
 * buffers name
 * - map: a hash map of notes or a range of notes mapped to a sample name and
 * sample playing options. For example:
 * `map: {'C2': { sample: 'c2 sound' }, 'C3-C4': { sample: 'c3 sound'}}`
 */
module.exports = function MidiProgram (program, options) {
  options = options || {}
  var midi = {}

  var unused = options.auto === false ? program.keys() : midiFromNames(midi, program)
  if (options.map) addMap(midi, program, options.map)

  return {
    unusedKeys: function () { return unused.slice() },
    keys: function () { return Object.keys(midi) },
    get: function (name) { return midi[toMidi(name) || name] }
  }
}

function midiFromNames (midi, program) {
  var unused = []
  program.keys().forEach(function (name) {
    var m = toMidi(name)
    if (m) midi[m] = program.get(name)
    else unused.push(name)
  })
  return unused
}

function addMap (midi, program, midiMap) {
  Object.keys(midiMap).forEach(function (range) {
    var rangeOpts = midiMap[range]
    var sample = program.get(rangeOpts.sample)
    if (!sample) throw Error('Sample not found => ' + range + ':' + rangeOpts)
    if (range.indexOf('-') === -1) range = range + '-' + range
    var split = range.split(/\s*-\s*/)
    var min = toMidi(split[0])
    var max = toMidi(split[1])
    var tone = toMidi(rangeOpts.tone)
    for (var i = min; i <= max; i++) {
      var opts = merge(merge({}, rangeOpts), sample.params)
      delete opts.sample
      delete opts.tone
      if (tone) opts.detune = (i - tone) * 100
      midi[i] = { buffer: sample.buffer, params: opts }
    }
  })
}

function merge (dest, src) {
  Object.keys(src).forEach(function (key) {
    dest[key] = src[key]
  })
  return dest
}
