/* globals XMLHttpRequest */
'use strict'

var b64decode = require('./b64decode.js')
var REPO = /^(@[\w-]+)\/(.*)$/

/**
 * Create a Sample Loader
 *
 * @param {AudioContext} ac - the audio context
 * @param {Object} options - the loader options
 */
var Loader = function (ac, options) {
  options = options || {}
  var loader = { ac: ac, read: options.read || getRequest }

  loader.load = function (promise) {
    if (!promise.then) return loader.load(Promise.resolve(promise))
    return promise.then(function (value) {
      var l = Loader.loaders[getLoader(value)]
      return l ? l(value, loader) : null
    })
  }
  return loader
}

/**
 * Given a value, get the appropiate loader name
 */
function getLoader (value) {
  switch (typeof value) {
    case 'object':
      if (value instanceof ArrayBuffer) return 'arraybuffer'
      else return 'object'
      break
    case 'string':
      if (/^data:audio/.test(value)) return 'base64'
      else if (/\.json$/.test(value)) return 'json'
      else if (REPO.test(value)) return 'custom'
      else return 'audioFile'
      break
    default:
  }
}

/**
 * A collection of loaders mapped by type
 * A loader is a function that given a value returns a promise to an audio buffer
 */
Loader.loaders = {
  'unknown': function (value) {
    return Promise.reject('Invalid value: ' + value)
  },

  //
  'arraybuffer': function (data, loader) {
    return new Promise(function (done, reject) {
      loader.ac.decodeAudioData(data, function (buffer) { done(buffer) },
      function () {
        reject("Can't decode audio data (" + data.slice(0, 30) + '...)')
      })
    })
  },

  'object': function (object, loader) {
    var source = object.samples ? object.samples : object
    var buffers = {}
    var promises = Object.keys(source).map(function (key) {
      return loader.load(source[key]).then(function (b) { buffers[key] = b })
    })
    return Promise.all(promises).then(function () {
      if (!object.samples) return buffers
      object.samples = buffers
      return object
    })
  },

  // load a base64 encoded audio string
  'base64': function (str, loader) {
    var data = str.split(',')[1]
    var decoded = b64decode(data).buffer
    return Promise.resolve(decoded).then(loader.load)
  },

  // load a json file
  'json': function (url, loader) {
    return loader.read(url, 'json').then(loader.load)
  },

  'audioFile': function (audioFile, loader) {
    return loader.read(audioFile, 'arraybuffer').then(loader.load)
  },

  'custom': function (repo, loader) {
    var m = REPO.exec(repo)
    var name = m[1]
    var path = m[2]
    var l = Loader.loaders[name] || Loader.loaders['unknown']
    return l(path, loader)
  },

  // parse a midi.js file
  '@midijs': function (url, loader) {
    return loader.read(url, 'text').then(function (data) {
      var begin = data.indexOf('MIDI.Soundfont.')
      if (begin < 0) throw Error('Invalid MIDI.js Soundfont format')
      begin = data.indexOf('=', begin) + 2
      var end = data.lastIndexOf(',')
      return JSON.parse(data.slice(begin, end) + '}')
    }).then(loader.load)
  },

  // load soundfonts from Benjamin Gleitzman repo using rawgit
  '@soundfont': function (name, loader) {
    var url = 'https://cdn.rawgit.com/gleitz/midi-js-Soundfonts/master/FluidR3_GM/' + name + '-ogg.js'
    return loader.load('@midijs/' + url)
  },

  /**
   * Load instruments from samplr/package/drum-machies repositiory
   */
  '@drum-machines': function (name, loader) {
    var path = name + '/' + name + '.json'
    var url = 'https://cdn.rawgit.com/danigb/samplr/master/packages/drum-machines/' + path
    return loader.load(url)
  }
}

/**
 * Wrap a GET request into a promise
 *
 * @private
 */
function getRequest (url, type) {
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

module.exports = Loader
