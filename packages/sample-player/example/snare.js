/* global AudioContext XMLHttpRequest */
var ac = new AudioContext()
var player = require('..')

console.log('loading sample...')

var request = new XMLHttpRequest()
request.open('GET', 'example/maesnare.wav', true)
request.responseType = 'arraybuffer'

request.onload = function () {
  ac.decodeAudioData(request.response, onBufferLoaded, function (err) {
    console.error('Load error', err)
  })
}
request.send()

function onBufferLoaded (buffer) {
  var p = player(ac, buffer).connect(ac.destination)
  p.start()
}
