/* globals describe it */
var assert = require('assert')
var SampleProgram = require('../lib/sample-program')
var MidiProgram = require('../lib/midi-program')

describe('Midi program', function () {
  var inst = SampleProgram({'c2': 'A buffer', 'c3': 'B buffer'}, { gain: 0.3 })

  it('map notes by default', function () {
    var midi = MidiProgram(inst)
    assert.deepEqual(midi.keys(), [36, 48])
    assert.deepEqual(midi.get(36), { buffer: 'A buffer', params: { gain: 0.3 } })
  })

  it('can add custom midi mapping', function () {
    var midi = MidiProgram(inst, { map: { 'C4': { 'sample': 'c3', detune: 1200 } } })
    assert.deepEqual(midi.keys(), ['36', '48', '60'])
    assert.deepEqual(midi.get(60), { buffer: 'B buffer',
      params: { gain: 0.3, detune: 1200 } })
  })

  it('can add range mappings', function () {
    var midi = MidiProgram(inst, { map: { 'C4-C5': { sample: 'c3', tone: 'c3' } } })
    assert.deepEqual(midi.keys(), ['36', '48', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72'])
    assert.deepEqual(midi.get(60), { buffer: 'B buffer',
      params: { gain: 0.3, detune: 1200 } })
    assert.deepEqual(midi.get(72), { buffer: 'B buffer',
      params: { gain: 0.3, detune: 2400 } })
  })

  it('get unused names', function () {
    var dm = SampleProgram({ snare: 'snare buffer', 'c4': 'c4 buffer' })
    var midi = MidiProgram(dm)
    assert.deepEqual(midi.keys(), [60])
    assert.deepEqual(midi.unusedKeys(), ['snare'])
  })
})
