/* global XMLHttpRequest */
'use strict'

var b64decode = require('./b64decode.js')
var PREFIXED = /^(@[\w-]+)\/(.*)$/

/**
 * Create a sample loader
 *
 * @param {AudioContext} ac - the audio context
 * @param {HashMap} options - (Optional) options
 * @return {Function} a load function
 */
function loader (ac, options) {
  var opts = options || {}
  var fetch = opts.fetch || httpRequest
  var prefixes = PREFIXES

  return function load (value) {
    if (value instanceof ArrayBuffer) return loadArrayBuffer(ac, value)
    else if (Array.isArray(value)) return loadArrayData(value, load)
    else if (typeof value === 'object') return loadObjectData(value, load)
    else if (typeof value === 'string') {
      if (/^data:audio/.test(value)) return decodeBase64(value, load)
      else if (/\.json$/.test(value)) return loadJsonFile(value, load, fetch)
      else if (PREFIXED.test(value)) return loadPrefix(prefixes, value, load, fetch)
      else return loadAudioFile(value, load, fetch)
    }
    else return Promise.reject('Value not valid: ' + value)
  }
}

function loadArrayBuffer (ac, data) {
  if (!(data instanceof ArrayBuffer)) return null
  return new Promise(function (done, reject) {
    ac.decodeAudioData(data,
      function (buffer) { done(buffer) },
      function () { reject("Can't decode audio data (" + data.slice(0, 30) + '...)') }
    )
  })
}

function loadArrayData (array, load) {
  return Promise.all(array.map(load))
}

function loadObjectData (object, load) {
  var source = object.samples ? object.samples : object
  var buffers = {}
  var promises = Object.keys(source).map(function (key) {
    return load(source[key]).then(function (b) { buffers[key] = b })
  })
  return Promise.all(promises).then(function () {
    if (!object.samples) return buffers
    object.samples = buffers
    return object
  })
}

function decodeBase64 (data, load) {
  var payload = data.split(',')[1]
  return load(b64decode(payload).buffer)
}

function loadAudioFile (url, load, fetch) {
  return load(fetch(url, 'arraybuffer'))
}

function loadJsonFile (url, load, fetch) {
  return load(fetch(url, 'json'))
}

function loadPrefix (prefixes, value, load, fetch) {
  var m = PREFIXED.exec(value)
  var fn = prefixes[m[1]]
  return fn ? fn(m[2], load, fetch) : Promise.reject('Unknown prefix: ' + m[1])
}

var PREFIXES = {
  '@midijs': function (url, load, fetch) {
    return fetch(url, 'text').then(function (data) {
      var begin = data.indexOf('MIDI.Soundfont.')
      if (begin < 0) throw Error('Invalid MIDI.js Soundfont format')
      begin = data.indexOf('=', begin) + 2
      var end = data.lastIndexOf(',')
      return JSON.parse(data.slice(begin, end) + '}')
    }).then(load)
  },
  '@soundfont': function (name, load) {
    var url = 'https://cdn.rawgit.com/gleitz/midi-js-Soundfonts/master/FluidR3_GM/' + name + '-ogg.js'
    return load('@midijs/' + url)
  },
  '@drum-machines': function (name, load) {
    var path = name + '/' + name + '.json'
    var url = 'https://cdn.rawgit.com/danigb/samplr/master/packages/drum-machines/' + path
    return load(url)
  }
}

/**
 * Wrap a GET request into a promise
 *
 * @private
 */
function httpRequest (url, type) {
  return new Promise(function (done, reject) {
    var req = new XMLHttpRequest()
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

if (typeof module === 'object' && module.exports) module.exports = loader
if (typeof window !== 'undefined') window.loader = loader
