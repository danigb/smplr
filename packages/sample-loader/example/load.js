var ac = new window.AudioContext()
var loader = require('..')(ac)
var player = require('sample-player')(ac)

function run () {
  var examples = Array.prototype.slice.call(arguments)
  var current = examples.length - 1
  var next = function (time) {
    if (current < 0) return
    var c = current
    time = time || 1000
    console.log('Next', current, examples[current].name)
    setTimeout(function () {
      examples[c](next)
    }, time)
    current--
  }
  next()
}
run(loadSample, loadObject, loadMidijs, loadJSONInst, loadJSON, loadBase64, loadSoundfont)

function loadSoundfont (next) {
  loader.load('@soundfont/marimba').then(function (buffers) {
    console.log('Marimba!')
    var now = ac.currentTime
    'C3 D3 E3 F3 G3 B3 C4 E4 B4 G4'.split(' ').forEach(function (name, i) {
      player(buffers[name]).connect(ac.destination).start(now + 0.3 * i)
    })
  })
}
function loadJSONInst (next) {
  loader.load('example/samples/maestro.json').then(function (maestro) {
    console.log('Maestro!', maestro)
    var now = ac.currentTime
    Object.keys(maestro.samples).forEach(function (name, i) {
      player(maestro.samples[name]).connect(ac.destination).start(now + 0.3 * i)
    })
    next()
  })
}

function loadJSON (next) {
  loader.load('example/samples/maestro.samples.json').then(function (buffers) {
    var now = ac.currentTime
    Object.keys(buffers).forEach(function (name, i) {
      player(buffers[name]).connect(ac.destination).start(now + 0.2 * i)
    })
    next()
  })
}

var audioData = require('./samples/blip.audio.js')
function loadBase64 (next) {
  loader.load(audioData).then(function (buffer) {
    console.log('base64 buffer', buffer)
    player(buffer).connect(ac.destination).start()
    next()
  })
}

function loadSample (next) {
  console.log('Loading sample...')
  loader.load('example/samples/blip.wav').then(function (buffer) {
    var now = ac.currentTime
    var sample = player(buffer).connect(ac.destination)
    sample.start(now).start(now + 0.2).start(now + 0.4)
    next()
  })
}

function loadObject (next) {
  var data = { 'snare': 'example/samples/maesnare.wav', clave: 'example/samples/maeclave.wav' }
  console.log('Load url object')
  loader.load(data).then(function (samples) {
    player(samples['clave']).connect(ac.destination).start()
    player(samples['snare']).connect(ac.destination).start(ac.currentTime + 0.2)
    next()
  })
}

function loadMidijs (next) {
  loader.load('@midijs/example/samples/piano-oct4-ogg.js').then(function (samples) {
    var now = ac.currentTime
    'C4 D4 E4 F4 G4 B4'.split(' ').forEach(function (note, i) {
      player(samples[note]).connect(ac.destination).start(now + 0.2 * i)
    })
    next(2000)
  })
}
