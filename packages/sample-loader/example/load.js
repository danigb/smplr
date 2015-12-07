var ac = new window.AudioContext()
var loader = require('..')(ac)
var player = require('sample-player')(ac)
var audioData = require('./blip.audio.js')

var next = (function (examples) {
  var current = examples.length
  return function () {
    console.log('Next', current)
    if (current) setTimeout(examples[current - 1], 1000)
    current--
  }
})([loadObject, loadSoundfont, loadBase64, loadSample])
next()

function loadBase64 () {
  loader.load(audioData).then(function (buffer) {
    player(buffer).connect(ac.destination).start()
  })
}

function loadSample () {
  console.log('Loading sample...')
  loader.load('example/blip.wav').then(function (buffer) {
    var now = ac.currentTime
    var sample = player(buffer).connect(ac.destination)
    sample.start(now).start(now + 0.2).start(now + 0.4)
    next()
  })
}

function loadObject () {
  var data = { 'snare': 'example/maesnare.wav', clave: 'example/maeclave.wav' }
  console.log('Load url object')
  loader.load(data).then(function (samples) {
    player(samples['clave']).connect(ac.destination).start()
    player(samples['snare']).connect(ac.destination).start(ac.currentTime + 0.2)
    next()
  })
}

function loadSoundfont () {
  loader.load('example/acoustic_grand_piano-ogg.js').then(function (samples) {
    Object.keys(samples).forEach(function (name) {
      console.log(name)
      next()
    })
  })
}
