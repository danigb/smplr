/* global XMLHttpRequest */
'use strict'

var b64decode = require('./b64decode.js')
var PREFIXED = /^(@[\w-]+)\/(.*)$/
var AUDIO = /\.(mp3|wav|ogg)/

function merge (dest, src) {
  Object.keys(src).forEach(function (k) { dest[k] = src[k] })
  return dest
}

/**
 * Create a sample loader
 *
 * @param {AudioContext} ac - the audio context
 * @param {HashMap} options - (Optional) options. The options can include:
 * @return {Function} a load function
 */
function loader (ac, options) {
  var opts = options || {}
  var fetch = opts.fetch || httpRequest
  var prefixes = merge({}, PREFIXES)
  if (opts.sources) merge(prefixes, opts.sources)

  return function load (value) {
    if (value instanceof Promise) return value.then(function (v) { return load(v) })

    if (value instanceof ArrayBuffer) return loadArrayBuffer(ac, value)
    else if (Array.isArray(value)) return loadArrayData(value, load)
    else if (typeof value === 'object') return loadObjectData(value, load)
    else if (typeof value === 'string') {
      if (/^data:audio/.test(value)) return decodeBase64(value, load)
      else if (/\.json$/.test(value)) return loadJsonFile(value, load, fetch)
      else if (PREFIXED.test(value)) return loadPrefix(prefixes, value, load, fetch)
      else if (AUDIO.test(value)) return loadAudioFile(value, load, fetch)
      else return Promise.resolve(value)
    }
    else return Promise.resolve(value)
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

function loadObjectData (source, load) {
  var dest = {}
  var promises = Object.keys(source).map(function (key) {
    return load(source[key]).then(function (result) { dest[key] = result })
  })
  return Promise.all(promises).then(function () {
    return dest
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
  var prefix = m[1]
  var path = m[2]
  var fn = prefixes[prefix]
  if (!fn) return Promise.reject('Unknown prefix: ' + prefix)
  else if (typeof fn === 'function') return fn(path, load, fetch)
  else return load(fn + '/' + path)
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
    var url = 'https://cdn.rawgit.com/danigb/smplr/master/packages/drum-machines/' + path
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
