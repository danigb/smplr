/* globals describe it AudioContext AudioBuffer */
require('web-audio-test-api')
var assert = require('assert')
var ac = new AudioContext()
var load = require('../')(ac)
var stub = require('sinon').stub

function base64 (data) { return 'data:audio/mp3;base64,' + data }
function arrayBuffer (l) { return new ArrayBuffer(l) }

describe('sample-loader', () => {
  it('decodes ArrayBuffer', done => {
    load(arrayBuffer(10)).then(buffer => {
      assert(buffer instanceof AudioBuffer)
    }).then(done, done)
  })

  it('decodes Base64', done => {
    load(base64('sample')).then(buffer => {
      assert(buffer instanceof AudioBuffer)
    }).then(done, done)
  })

  it('load audio file from file names', done => {
    load('path/to/file.mp3', { fetch: stub().returns(arrayBuffer(10)) }).then(buffer => {
      assert(buffer instanceof AudioBuffer)
    }).then(done, done)
  })

  it('loads arrays', done => {
    var data = [ base64('A'), base64('B') ]
    load(data).then(buffers => {
      assert(Array.isArray(buffers))
      assert(buffers[0] instanceof AudioBuffer)
      assert(buffers[1] instanceof AudioBuffer)
    }).then(done, done)
  })
})

describe('Prefixed', () => {
  it('@soundfont instrument names', done => {
    var fetch = stub().returns(Promise.resolve(MIDIJS))
    load('@soundfont/piano', { fetch }).then(buffers => {
      assert.equal(fetch.getCall(0).args[0],
        'https://cdn.rawgit.com/gleitz/midi-js-Soundfonts/master/FluidR3_GM/piano-ogg.js')
    }).then(done, done)
  })

  it('@drum-machies instrument names', done => {
    var fetch = stub().returns({ 'snare': base64('snare') })
    load('@drum-machines/808', { fetch }).then(buffers => {
      assert.equal(fetch.getCall(0).args[0],
        'https://cdn.rawgit.com/danigb/samplr/master/packages/drum-machines/808/808.json')
      assert(buffers['snare'] instanceof AudioBuffer)
    }).then(done, done)
  })

  it('@midijs file urls', done => {
    var fetch = stub().returns(Promise.resolve(MIDIJS))
    load('@midijs/file.js', { fetch }).then(buffers => {
      assert.deepEqual(Object.keys(buffers), ['A', 'B'])
      assert(buffers['A'] instanceof AudioBuffer)
      assert(buffers['B'] instanceof AudioBuffer)
    }).then(done, done)
  })
})

describe('Object as values', () => {
  it('JSON: fetch object', done => {
    var data = { a: base64('a'), b: base64('a') }
    load('file.json', { fetch: stub().returns(data) }).then(buffers => {
      assert.deepEqual(Object.keys(buffers), ['a', 'b'])
      assert(buffers['a'] instanceof AudioBuffer)
      assert(buffers['b'] instanceof AudioBuffer)
    }).then(done, done)
  })

  it('load base64 values', done => {
    var inst = { a: base64('a'), b: base64('b') }
    load(inst).then(buffers => {
      assert.deepEqual(Object.keys(buffers), ['a', 'b'])
      assert(buffers['a'] instanceof AudioBuffer)
      assert(buffers['b'] instanceof AudioBuffer)
    }).then(done, done)
  })
  it('load audio file values', done => {
    var inst = { a: 'a.mp3', b: 'b.mp3' }
    load(inst, { fetch: stub().returns(arrayBuffer(10)) }).then(buffers => {
      assert.deepEqual(Object.keys(buffers), ['a', 'b'])
      assert(buffers['a'] instanceof AudioBuffer)
      assert(buffers['b'] instanceof AudioBuffer)
    }).then(done, done)
  })
  it('load samples object', done => {
    var inst = { name: 'name', samples: { a: base64('a'), b: base64('b') } }
    load(inst).then(result => {
      assert(inst === result)
      assert.deepEqual(Object.keys(inst.samples), ['a', 'b'])
      assert(inst.samples['a'] instanceof AudioBuffer)
      assert(inst.samples['b'] instanceof AudioBuffer)
    }).then(done, done)
  })
})

var MIDIJS =
'if (typeof(MIDI) === "undefined") let MIDI = {};' +
'if (typeof(MIDI.Soundfont) === "undefined") MIDI.Soundfont = {};' +
'MIDI.Soundfont.acoustic_grand_piano = {' +
'  "A": "data:audio/ogg;base64,MQ==",' +
'  "B": "data:audio/ogg;base64,MQ==",' +
'}'
