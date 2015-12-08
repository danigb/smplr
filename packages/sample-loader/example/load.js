var ac = new window.AudioContext()
var loader = require('..')(ac)
var player = require('sample-player')(ac)

function play (name, samples, buffers) {
  if (typeof samples === 'string') samples = samples.split(' ')
  var now = ac.currentTime
  console.log(name, samples, now)
  samples.forEach(function (name, i) {
    player(buffers[name]).connect(ac.destination).start(now + 0.3 * i)
  })
}

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
run(loadSample, loadObject, loadMidijs, loadJSONInst, loadJSON, loadBase64,
  loadSoundfont, loadDrumMachines)

function loadDrumMachines (done) {
  loader.load('@drum-machines/maestro').then(function (maestro) {
    play('Maestro drum machine!', Object.keys(maestro.samples).reverse(), maestro.samples)
    done(2000)
  })
}
function loadSoundfont (done) {
  loader.load('@soundfont/marimba').then(function (buffers) {
    play('Marimba!', 'C3 D3 E3 F3 G3 B3 C4 E4 B4 G4', buffers)
    done(2000)
  })
}

function loadJSONInst (done) {
  loader.load('example/samples/maestro.json').then(function (maestro) {
    play('Maestro instrument!', Object.keys(maestro.samples), maestro.samples)
    done()
  })
}

function loadJSON (done) {
  loader.load('example/samples/maestro.samples.json').then(function (buffers) {
    play('Maestro buffers', Object.keys(buffers), buffers)
    done()
  })
}

var audioData = require('./samples/blip.audio.js')
function loadBase64 (done) {
  loader.load(audioData).then(function (buffer) {
    console.log('base64 buffer', buffer)
    player(buffer).connect(ac.destination).start()
    done()
  })
}

function loadSample (done) {
  console.log('Loading sample...')
  loader.load('example/samples/blip.wav').then(function (buffer) {
    var now = ac.currentTime
    var sample = player(buffer).connect(ac.destination)
    sample.start(now).start(now + 0.2).start(now + 0.4)
    done()
  })
}

function loadObject (done) {
  var data = { 'snare': 'example/samples/maesnare.wav', clave: 'example/samples/maeclave.wav' }
  loader.load(data).then(function (buffers) {
    play('Object', 'clave snare', buffers)
    done()
  })
}

function loadMidijs (done) {
  loader.load('@midijs/example/samples/piano-oct4-ogg.js').then(function (buffers) {
    play('Piano oct4', 'C4 D4 E4 F4 G4 B4', buffers)
    done(2000)
  })
}
