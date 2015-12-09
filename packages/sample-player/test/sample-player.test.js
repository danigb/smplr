/* globals describe it AudioContext */
require('web-audio-test-api')
var assert = require('assert')
var ac = new AudioContext()
var player = require('../')(ac)
var sinon = require('sinon')

function audioBuffer (ch, secs) { return ac.createBuffer((ch || 1), (secs || 1) * ac.sampleRate, ac.sampleRate) }

describe('sample-player', () => {
  describe('create player', () => {
    it('buffer is required', () => {
      assert.throws(function () { player(null) })
    })

    it('has API', () => {
      var p = player(audioBuffer())
      assert.equal(typeof p, 'object')
      assert.equal(typeof p.start, 'function')
      assert.equal(typeof p.stop, 'function')
      assert.equal(typeof p.nodes, 'function')
    })
  })

  describe('player object properties', () => {
    var p = player(audioBuffer())
    it('have nodes', () => {
      assert.deepEqual(Object.keys(p.nodes()), ['gain'])
    })
  })

  describe('playing', () => {
    it('can detune the sample', () => {
      var p1 = player(audioBuffer(), { detune: 0 })
      assert.equal(p1.start().source.playbackRate.value, 1)
      var p2 = player(audioBuffer(), { detune: 100 })
      assert.equal(p2.start().source.playbackRate.value, 1.0594630943592953)
    })
  })

  describe('stop', () => {
    it('stops all sounds', () => {
      var p = player(audioBuffer()).connect(ac.destination)
      var n1 = p.start()
      var n2 = p.start()
      n1.source.stop = sinon.spy()
      n2.source.stop = sinon.spy()
      p.stop()
      assert(n1.source.stop.calledOnce)
      assert(n2.source.stop.calledOnce)
    })
  })
})
