/* globals describe it */
var assert = require('assert')
var Instrument = require('../lib/instrument')
var Midi = require('../lib/midi')

describe('Sample instrument midi interface', function () {
  var inst = Instrument({'c2': 'A buffer', 'c3': 'B buffer'}, { gain: 0.3 })

  it('map notes by default', function () {
    var midi = Midi(inst)
    assert.deepEqual(midi.names(), [36, 48])
    assert.deepEqual(midi.get(36), { buffer: 'A buffer', options: { gain: 0.3 } })
  })

  it('can add custom midi mapping', function () {
    var midi = Midi(inst, { map: { 'C4': { 'sample': 'c3', detune: 1200 } } })
    assert.deepEqual(midi.names(), ['36', '48', '60'])
    assert.deepEqual(midi.get(60), { buffer: 'B buffer',
      options: { gain: 0.3, detune: 1200 } })
  })

  it('can add range mappings', function () {
    var midi = Midi(inst, { map: { 'C4-C5': { sample: 'c3', tone: 'c3' } } })
    assert.deepEqual(midi.names(), ['36', '48', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72'])
    assert.deepEqual(midi.get(60), { buffer: 'B buffer',
      options: { gain: 0.3, detune: 1200 } })
    assert.deepEqual(midi.get(72), { buffer: 'B buffer',
      options: { gain: 0.3, detune: 2400 } })
  })

  it('get unused names', function () {
    var dm = Instrument({ snare: 'snare buffer', 'c4': 'c4 buffer' })
    var midi = Midi(dm)
    assert.deepEqual(midi.names(), [60])
    assert.deepEqual(midi.unused(), ['snare'])
  })
})
