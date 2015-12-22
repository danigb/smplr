/* globals describe it */
var assert = require('assert')
var Program = require('../lib/program')

describe('Program', function () {
  it('remove midified names', function () {
    var pr = Program({ samples: { 'c2': 'c2 audio', 'snare': 'snare audio' } })
    assert.deepEqual(pr.keys(), [ '36', 'snare' ])
  })
})
