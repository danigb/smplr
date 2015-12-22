/* globals describe it AudioContext */
require('web-audio-test-api')
var assert = require('assert')
var ac = new AudioContext()
var smplr = require('../')(ac)

function audio (ch, secs) { return ac.createBuffer((ch || 1), (secs || 1) * ac.sampleRate, ac.sampleRate) }

describe('smplr', function (done) {
  it('load a program with samples', function (done) {
    var program = { name: 'piano', samples: { 'c2': audio(), 'c3': audio() } }
    smplr(program).then(function (piano) {
      assert.deepEqual(piano.keys(), [36, 48])
      assert(piano.get('c2').start)
    }).then(done, done)
  })
})
