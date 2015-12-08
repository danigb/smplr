/* globals describe it AudioContext AudioBuffer */

require('web-audio-test-api')
var assert = require('assert')
var fs = require('./fs.mock.js')
var ac = new AudioContext()
var loader = require('..')(ac, { read: fs.read })

var data =
'if (typeof(MIDI) === "undefined") let MIDI = {};' +
'if (typeof(MIDI.Soundfont) === "undefined") MIDI.Soundfont = {};' +
'MIDI.Soundfont.acoustic_grand_piano = {' +
'  "A": "data:audio/ogg;base64,MQ==",' +
'  "B": "data:audio/ogg;base64,MQ==",' +
'}'

describe('Load extensions', function () {
  it('loads @midijs files', function (done) {
    fs.addFile('file.js', data)
    loader.load('@midijs/file.js').then(function (buffers) {
      assert.deepEqual(Object.keys(buffers), ['A', 'B'])
      assert(buffers.A instanceof AudioBuffer)
      assert(buffers.B instanceof AudioBuffer)
    }).then(done, done)
  })

  it('loads @soundfont files', function (done) {
    var url = 'https://cdn.rawgit.com/gleitz/midi-js-Soundfonts/master/FluidR3_GM/piano-ogg.js'
    fs.addFile(url, data)
    loader.load('@soundfont/piano').then(function (buffers) {
      assert.deepEqual(Object.keys(buffers), ['A', 'B'])
      assert(buffers.A instanceof AudioBuffer)
      assert(buffers.B instanceof AudioBuffer)
    }).then(done, done)
  })
})
