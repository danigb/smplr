/* globals describe it AudioContext */
require('web-audio-test-api')
var assert = require('assert')
var ctx = new AudioContext()
var loader = require('..')(ctx)

describe('loader', function () {
  it('always return a promise', function () {
    var p = loader.load('anything')
    assert(p.then)
  })
})
