/* globals describe it AudioContext AudioBuffer */
require('web-audio-test-api')
var assert = require('assert')
var fs = require('./fs.mock.js')
var ac = new AudioContext()

var loader = require('..')(ac, { read: fs.read })

function encode (str) { return 'data:audio/mp3base64,' + new Buffer(str).toString('base64') }

describe('sample-loader', function () {
  describe('load encoded audio strings', function () {
    it('base64 encoded audio', function (done) {
      loader.load(encode('audio-data')).then(function (buffer) {
        assert(buffer instanceof AudioBuffer)
      }).then(done, done)
    })
  })

  describe('audio files', function () {
    it('load audio files', function (done) {
      fs.add('path/file.mp3')
      loader.load('path/file.mp3').then(function (buffer) {
        assert(buffer instanceof AudioBuffer)
      }).then(done, done)
    })
  })

  describe('load objects', function () {
    it('load hash maps of encoded audio', function (done) {
      var samples = { a: encode('sample-a'), b: encode('sample-b') }
      loader.load(samples).then(function (buffers) {
        assert.deepEqual(Object.keys(buffers), ['a', 'b'])
        assert(buffers['a'] instanceof AudioBuffer)
        assert(buffers['b'] instanceof AudioBuffer)
      }).then(done, done)
    })

    it('loads an object with samples encoded', function (done) {
      var inst = { name: 'inst', samples: { a: encode('sample-a'), b: encode('sample-b') } }
      loader.load(inst).then(function (result) {
        assert(inst === result)
        assert(inst.samples.a instanceof AudioBuffer)
        assert(inst.samples.b instanceof AudioBuffer)
      }).then(done, done)
    })

    it('loads an object with samples as files', function (done) {
      var inst = { name: 'inst', samples: { a: 'a.mp3', b: 'b.mp3' } }
      fs.add('a.mp3', 'b.mp3')
      loader.load(inst).then(function (result) {
        assert(inst === result)
        assert(inst.samples.a instanceof AudioBuffer)
        assert(inst.samples.b instanceof AudioBuffer)
      }).then(done, done)
    })

    it('load hash maps of file names', function (done) {
      var samples = { a: 'fileA.mp3', b: 'fileB.mp3' }
      fs.add('fileA.mp3', 'fileB.mp3')
      loader.load(samples).then(function (buffers) {
        assert.deepEqual(Object.keys(buffers), ['a', 'b'])
        assert(buffers['a'] instanceof AudioBuffer)
        assert(buffers['b'] instanceof AudioBuffer)
      }).then(done, done)
    })
  })
})
