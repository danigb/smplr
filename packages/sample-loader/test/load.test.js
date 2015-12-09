/* globals describe it AudioContext AudioBuffer */
require('web-audio-test-api')
var assert = require('assert')
var ac = new AudioContext()
var loader = require('../')
var stub = require('sinon').stub

function base64 (data) { return 'data:audio/mp3;base64,' + data }
function arrayBuffer (l) { return new ArrayBuffer(l) }
function serve (value) { return stub().returns(Promise.resolve(value)) }

describe('sample-loader', () => {
  var load = loader(ac)
  it('returns a promise', () => {
    assert(load('blah').then)
  })

  it('decodes a promise', done => {
    load(Promise.resolve(base64('audio'))).then(function (buffer) {
      assert(buffer instanceof AudioBuffer)
    }).then(done, done)
  })
})

describe('Load primitives', () => {
  it('decodes ArrayBuffer', done => {
    var load = loader(ac)
    load(arrayBuffer(10)).then(buffer => {
      assert(buffer instanceof AudioBuffer)
    }).then(done, done)
  })

  it('decodes Base64', done => {
    var load = loader(ac)
    load(base64('sample')).then(buffer => {
      assert(buffer instanceof AudioBuffer)
    }).then(done, done)
  })

  it('load audio file from file names', done => {
    var load = loader(ac, { fetch: serve(arrayBuffer(10)) })
    load('path/to/file.mp3').then(buffer => {
      assert(buffer instanceof AudioBuffer)
    }).then(done, done)
  })

  it('loads arrays', done => {
    var load = loader(ac)
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
    var fetch = serve(MIDIJS)
    var load = loader(ac, { fetch })
    load('@soundfont/piano').then(buffers => {
      assert.equal(fetch.getCall(0).args[0],
        'https://cdn.rawgit.com/gleitz/midi-js-Soundfonts/master/FluidR3_GM/piano-ogg.js')
    }).then(done, done)
  })

  it('@drum-machies instrument names', done => {
    var fetch = serve({ 'snare': base64('snare') })
    var load = loader(ac, { fetch })
    load('@drum-machines/808').then(buffers => {
      assert.equal(fetch.getCall(0).args[0],
        'https://cdn.rawgit.com/danigb/smplr/master/packages/drum-machines/808/808.json')
      assert(buffers['snare'] instanceof AudioBuffer)
    }).then(done, done)
  })

  it('@midijs file urls', done => {
    var fetch = serve(MIDIJS)
    var load = loader(ac, { fetch })
    load('@midijs/file.js').then(buffers => {
      assert.deepEqual(Object.keys(buffers), ['A', 'B'])
      assert(buffers['A'] instanceof AudioBuffer)
      assert(buffers['B'] instanceof AudioBuffer)
    }).then(done, done)
  })
})

describe('Object as values', () => {
  it('load JSON file', done => {
    var data = { a: base64('a'), b: base64('a') }
    var load = loader(ac, { fetch: serve(data) })
    load('file.json').then(buffers => {
      assert.deepEqual(Object.keys(buffers), ['a', 'b'])
      assert(buffers['a'] instanceof AudioBuffer)
      assert(buffers['b'] instanceof AudioBuffer)
    }).then(done, done)
  })

  it('load base64 values', done => {
    var load = loader(ac)
    var inst = { a: base64('a'), b: base64('b') }
    load(inst).then(buffers => {
      assert.deepEqual(Object.keys(buffers), ['a', 'b'])
      assert(buffers['a'] instanceof AudioBuffer)
      assert(buffers['b'] instanceof AudioBuffer)
    }).then(done, done)
  })
  it('load audio file values', done => {
    var load = loader(ac, { fetch: serve(arrayBuffer(10)) })
    var inst = { a: 'a.mp3', b: 'b.mp3' }
    load(inst).then(buffers => {
      assert.deepEqual(Object.keys(buffers), ['a', 'b'])
      assert(buffers['a'] instanceof AudioBuffer)
      assert(buffers['b'] instanceof AudioBuffer)
    }).then(done, done)
  })
  it('load samples object', done => {
    var load = loader(ac)
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
