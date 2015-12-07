/* globals describe it AudioContext */
require('web-audio-test-api')
var assert = require('assert')
var ctx = new AudioContext()
var fail = function () { assert(false, 'should fail') }

var loader = require('..')(ctx)
describe('sample loader', function () {
  it('should return a promise', function () {
    var p = loader('anything')
    assert(p.then)
  })

  it('should get a url', function (done) {
    var p = loader('http://example.com/audio.mp')
    p.then(fail, function (value) {
      console.log('ea', value)
    }).then(done, done)
  })
})
