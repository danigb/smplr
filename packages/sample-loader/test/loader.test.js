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

  it('handles invalid values', function (done) {
    loader.load('@something/invalid').then(function () {
      assert(false, 'Should not pass')
    }, function (err) {
      assert(err)
    }).then(done, done)
  })
})
