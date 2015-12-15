/* globals describe it AudioContext */
require('web-audio-test-api')
var assert = require('assert')
var ac = new AudioContext()
var Sampler = require('../')(ac)

function audio (ch, secs) { return ac.createBuffer((ch || 1), (secs || 1) * ac.sampleRate, ac.sampleRate) }

describe('Sampler', function () {
  describe('simple instrument', function () {
    var sampler = Sampler({ name: 'TR-808', samples: {snare: audio()} })

    it('has names', function () {
      assert.deepEqual(sampler.names(), ['snare'])
    })
    it('returns a player', function () {
      assert(sampler.get('snare').start)
    })
  })

  describe('midi instrument', function () {
    var sampler = Sampler({ name: 'piano', samples: {'c2': audio(), 'c3': audio()} })

    it('has names', function () {
      assert.deepEqual(sampler.names(), [36, 48])
    })
    it('returns a player', function () {
      assert(sampler.get('36').start)
      assert(sampler.get('C2').start)
      assert(sampler.get('c2').start)
      assert(sampler.get('Dbb2').start)
      assert(sampler.get('B#1').start)
    })
  })

  describe('mapped instrument', function () {
    var sampler = Sampler({ name: 'one note', samples: {'c2': audio()},
      midi: { map: {'24-60': {sample: 'c2', tone: 'c2'}} } })

    it('has names', function () {
      assert.deepEqual(sampler.names(), ['24', '25', '26', '27', '28', '29',
        '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41',
        '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53',
        '54', '55', '56', '57', '58', '59', '60'])
    })

    it('returns players', function () {
      assert(sampler.get('c3').start)
    })
  })
})
