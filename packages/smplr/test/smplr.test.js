/* globals describe it AudioContext */
require('web-audio-test-api')
var assert = require('assert')
var ac = new AudioContext()
var smplr = require('../')(ac)

describe('smplr', () => {
  it('exists', () => {
    assert(smplr)
  })
})
