var ac = new window.AudioContext()
var loader = require('..')(ac)
var player = require('sample-player')(ac)

var next = (function (examples) {
  var current = examples.length
  return function (time) {
    time = time || 1000
    console.log('Next', current)
    if (current > 0) setTimeout(examples[current - 1], time)
    current--
  }
})([loadSample, loadObject, loadSoundfont, loadJSON, loadBase64])
next()

function loadJSON () {
  loader.load('example/samples/maestro.samples.json').then(function (buffers) {
    var now = ac.currentTime
    Object.keys(buffers).forEach(function (name, i) {
      player(buffers[name]).connect(ac.destination).start(now * 0.4 * i)
    })
  })
}

var audioData = require('./samples/blip.audio.js')
function loadBase64 () {
  loader.load(audioData).then(function (buffer) {
    console.log('base64 buffer', buffer)
    player(buffer).connect(ac.destination).start()
    next()
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
  loader.load('example/samples/piano-oct4-ogg.js').then(function (samples) {
    var now = ac.currentTime
    'C4 D4 E4 F4 G4 B4'.split(' ').forEach(function (note, i) {
      player(samples[note]).connect(ac.destination).start(now + 0.2 * i)
    })
    next(2000)
  })
}
