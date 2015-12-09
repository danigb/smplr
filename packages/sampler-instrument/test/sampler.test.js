/* globals describe it AudioContext */
require('web-audio-test-api')
var assert = require('assert')
var ac = new AudioContext()
var sampler = require('../')(ac)

function audio (ch, secs) { return ac.createBuffer((ch || 1), (secs || 1) * ac.sampleRate, ac.sampleRate) }

describe('sampler-instrument', () => {
  describe('sample players', () => {
    var props = { name: 'dm', samples: { a: audio(), b: audio() } }
    var dm = sampler(props)

    it('get sample players', () => {
      assert(dm.sample('a').start)
    })

    it('returns the samples names', () => {
      assert.deepEqual(dm.samples(), ['a', 'b'])
    })
  })

  describe('notes', () => {
    var piano = sampler({ name: 'piano', samples: { 'C4': audio(), 'D4': audio() } })

    it('get notes', () => {
      assert.deepEqual(piano.notes(), [60, 62])
    })

    it('get note player', () => {
      assert(piano.note(60).start)
    })
  })
})
