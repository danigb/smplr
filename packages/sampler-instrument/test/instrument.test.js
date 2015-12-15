/* globals describe it */
var assert = require('assert')
var instrument = require('../lib/instrument')

describe('Sample instrument', function () {
  it('Build instruments', function () {
    var i = instrument({'a': 'A buffer', 'b': 'B buffer'}, { detune: -1200 })
    assert.deepEqual(i.names(), ['a', 'b'])
    assert.deepEqual(i.get('a'), { buffer: 'A buffer', options: { detune: -1200 } })
    assert.deepEqual(i.get('b'), { buffer: 'B buffer', options: { detune: -1200 } })
  })
})
