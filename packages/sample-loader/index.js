'use strict'

var base64DecodeToArray = require('./b64decode.js')

var Loader = function (ac, get) {
  var loader = { ac: ac, get: get || getRequest }
  loader.middleware = [loadAudioFile, loadJSON, loadObject, loadSoundfont]

  loader.load = function (promise) {
    if (!promise.then) return loader.load(Promise.resolve(promise))
    var len = loader.middleware.length

    return promise.then(function (value) {
      var type = typeof value
      for (var i = len; i > 0; i--) {
        var m = loader.middleware[i - 1]
        if (m.test(type, value)) {
          console.log('Loading', m.name, value)
          return m(value, loader)
        }
      }
      return Promise.reject('Invalid value')
    })
  }
  return loader
}

function getRequest (url, type) {
  return new Promise(function (done, reject) {
    var req = new window.XMLHttpRequest()
    if (type) req.responseType = type
    req.open('GET', url)

    req.onload = function () {
      if (req.status === 200) {
        done(req.response)
      } else {
        reject(Error(req.statusText))
      }
    }
    req.onerror = function () {
      reject(Error('Network Error'))
    }
    req.send()
  })
}

function loadObject (object, loader) {
  var buffers = {}
  var promises = Object.keys(object).map(function (key) {
    return loader.load(object[key]).then(function (b) { buffers[key] = b })
  })
  return Promise.all(promises).then(function () {
    return buffers
  })
}
loadObject.test = function (t, v) { return t === 'object' }

function loadBase64Audio (str, loader) {
  var data = str.split(',')[1]
  Promise.resolve(base64DecodeToArray(data).buffer).then(createBuffer)
}
loadBase64Audio.test = function (t, v) { return t === 'string' && /^data:audio/.test(v) }

function loadSoundfont (url, loader) {
  return loader.get(url, 'text').then(function (data) {
    var begin = data.indexOf('MIDI.Soundfont.')
    if (begin < 0) throw Error('Invalid MIDI.js Soundfont format')
    begin = data.indexOf('=', begin) + 2
    return JSON.parse(data.slice(begin))
  }).then(loader.load)
}
loadSoundfont.test = function (t, v) { return t === 'string' && /\.js$/.test(v) }

function loadJSON (data, loader) {
}
loadJSON.test = function (t, v) { return t === 'string' && /\.json$/.test(v) }

function loadAudioFile (audioFile, loader) {
  return loader.get(audioFile, 'arraybuffer').then(createBuffer(loader.ac))
}
loadAudioFile.test = function (t, v) { return t === 'string' }

function createBuffer (ac) {
  return function (data) {
    return new Promise(function (done, reject) {
      ac.decodeAudioData(data, function (buffer) { done(buffer) },
        function () {
          reject("Can't decode audio data (" + data.slice(0, 30) + '...)')
        })
    })
  }
}

module.exports = Loader
