var ac = new window.AudioContext()
var loader = require('..')(ac)
var player = require('sample-player')(ac)

var next = (function (examples) {
  var current = examples.length
  return function () {
    console.log('Next', current)
    if (current > 0) setTimeout(examples[current - 1], 1000)
    current--
  }
})([loadSample, loadObject, loadSoundfont, loadBase64])
next()

var audioData = require('./samples/piano-note.audio.js')
function loadBase64 () {
  loader.load(audioData).then(function (buffer) {
    console.log('base64 buffer', buffer)
    player(buffer).connect(ac.destination).start()
  })
}

function loadSample () {
  console.log('Loading sample...')
  loader.load('example/samples/blip.wav').then(function (buffer) {
    var now = ac.currentTime
    var sample = player(buffer).connect(ac.destination)
    sample.start(now).start(now + 0.2).start(now + 0.4)
    next()
  })
}

function loadObject () {
  var data = { 'snare': 'example/samples/maesnare.wav', clave: 'example/samples/maeclave.wav' }
  console.log('Load url object')
  loader.load(data).then(function (samples) {
    player(samples['clave']).connect(ac.destination).start()
    player(samples['snare']).connect(ac.destination).start(ac.currentTime + 0.2)
    next()
  })
}

function loadSoundfont () {
  loader.load('example/samples/acoustic_grand_piano-ogg.js').then(function (samples) {
    console.log('soundfont samples', samples)
    player(samples['C4']).connect(ac.destination).start()
  })
}
