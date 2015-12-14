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

  describe('play', () => {
    var inst = sampler({ samples: { 'a': audio() } })
    it('start sampler if when is not specified', () => {
      var note = inst.play('a')
      assert(note.source.$state, 'PLAYING')
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

describe('Midi maps', () => {
  it('midi map with numbers', () => {
    var piano = sampler({ name: 'piano', samples: {'a': audio()}, midi: {
      60: { sample: 'a' },
      61: { sample: 'a', detune: 100 }
    }})
    assert.deepEqual(piano.notes(), [60, 61])
  })

  it('midi map with notes', () => {
    var piano = sampler({ name: 'piano', samples: {'a': audio()}, midi: {
      'c4': { sample: 'a' },
      'd4': { sample: 'a', detune: 100 }
    }})
    assert.deepEqual(piano.notes(), [60, 62])
  })

  it('accepts midi map with ranges', () => {
    var piano = sampler({ name: 'piano', samples: {'a': audio()}, midi: {
      'C3-C4': { sample: 'a', tone: 'C3' }
    }})
    assert.deepEqual(piano.notes(), [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60])
    assert.deepEqual(piano.props.midi[48], { sample: 'a', detune: 0 })
    assert.deepEqual(piano.props.midi[49], { sample: 'a', detune: 100 })
    assert.deepEqual(piano.props.midi[60], { sample: 'a', detune: 1200 })
  })
  it('throws error if invalid range', () => {
    assert.throws(() => {
      sampler({ samples: { 'a': audio() }, midi: { 'a-hg': { sample: 'a' } } })
    }, /a-hg/)
  })
})
