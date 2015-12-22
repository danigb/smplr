/* globals describe it */
var assert = require('assert')
var SampleProgram = require('../lib/sample-program')

describe('Sample program', function () {
  it('Build sample programs', function () {
    var i = SampleProgram({'a': 'A buffer', 'b': 'B buffer'}, { detune: -1200 })
    assert.deepEqual(i.keys(), ['a', 'b'])
    assert.deepEqual(i.get('a'), { buffer: 'A buffer', params: { detune: -1200 } })
    assert.deepEqual(i.get('b'), { buffer: 'B buffer', params: { detune: -1200 } })
  })
})
