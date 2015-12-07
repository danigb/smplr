'use strict'

var b64decode = require('./b64decode.js')

/**
 * Create a Sample Loader
 *
 * @param {AudioContext} ac - the audio context
 * @param {Object} options - the loader options
 */
var Loader = function (ac, options) {
  options = options || {}
  var loader = { ac: ac, get: options.get || getRequest }
  loader.middleware = [loadAudioFile, loadJSON, loadObject, decodeBase64Audio,
    loadSoundfont]

  loader.load = function (promise) {
    if (!promise.then) return loader.load(Promise.resolve(promise))
    var len = loader.middleware.length

    return promise.then(function (value) {
      var type = typeof value
      for (var i = len; i > 0; i--) {
        var m = loader.middleware[i - 1]
        if (m.test(type, value)) {
          return m(value, loader)
        }
      }
      return Promise.reject('Invalid value')
    })
  }
  return loader
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

function decodeBase64Audio (str, loader) {
  var data = str.split(',')[1]
  var decoded = b64decode(data).buffer
  return Promise.resolve(decoded).then(createBuffer(loader.ac))
}
decodeBase64Audio.test = function (t, v) { return t === 'string' && /^data:audio/.test(v) }

function loadSoundfont (url, loader) {
  return loader.get(url, 'text').then(function (data) {
    var begin = data.indexOf('MIDI.Soundfont.')
    if (begin < 0) throw Error('Invalid MIDI.js Soundfont format')
    begin = data.indexOf('=', begin) + 2
    var end = data.lastIndexOf(',')
    return JSON.parse(data.slice(begin, end) + '}')
  }).then(loader.load)
}
loadSoundfont.test = function (t, v) { return t === 'string' && /\.js$/.test(v) }

function loadJSON (url, loader) {
  return loader.get(url, 'json').then(loader.load)
}
loadJSON.test = function (t, v) { return t === 'string' && /\.json$/.test(v) }

function loadAudioFile (audioFile, loader) {
  return loader.get(audioFile, 'arraybuffer').then(createBuffer(loader.ac))
}
loadAudioFile.test = function (t, v) { return t === 'string' }

/**
 * Return a function that given a audio data array returns a promise to an
 * audio buffer
 *
 * @private
 */
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

/**
 * Wrap a GET request into a promise
 *
 * @private
 */
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

module.exports = Loader
