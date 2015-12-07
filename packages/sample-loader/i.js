'use strict'

var base64DecodeToArray = require('./b64decode.js')

/**
 * Load and decode a soundfont bank.
 *
 * @param {AudioContext} ctx - the audio context object
 * @param {String} url - the url of the js file
 * @param {Function} get - (Optional) given a url return a promise with the contents
 * @param {Function} parse - (Optinal) given a js file return JSON object
 */
module.exports = function load (ctx, source, parser, decoder) {
  if (arguments.length === 1) return function (s, p, d) { return load(ctx, s, p, d) }

  var deferred
  parser = parser || parseJavascript
  decoder = decoder || decodeBuffer

  if (!source) return Promise.reject('Source required.')
  if (typeof source === 'string') deferred = getRequest(source).then(parser)
  else if (source.then) deferred = source.then(parser)
  else if (typeof source === 'object') deferred = Promise.resolve(source)
  else return Promise.reject('Invalid source.')

  return deferred.then(function (data) {
    return decodeData(ctx, data, decoder)
  })
}

/**
 * Decode a soundfont data
 * @param {AudioContext} ctx - the audio context
 * @param {HashMap} data - a hash that maps note names to base64 encoded audio
 * @return {Promise} a promise that resolves a hashmap of note names to
 * waa [audio buffers](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer)
 * @private
 */
function decodeData (ctx, data, decoder) {
  var buffers = []
  var promises = Object.keys(data).map(function (note) {
    return decoder(ctx, data[note])
    .then(function (buffer) {
      buffers[note] = buffer
    })
  })

  return Promise.all(promises).then(function () {
    return buffers
  })
}

/**
 * Given a base64 encoded audio data, return a prmomise with an audio buffer
 *
 * @param {AudioContext} context - the [audio context](https://developer.mozilla.org/en/docs/Web/API/AudioContext)
 * @param {String} data - the base64 encoded audio data
 * @return {Promise} a promise that resolves to an [audio buffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer)
 * @private
 */
function decodeBuffer (context, data) {
  if (!context) return Promise.resolve(data)
  return new Promise(function (done, reject) {
    var decodedData = base64DecodeToArray(data.split(',')[1]).buffer
    context.decodeAudioData(decodedData, function (buffer) {
      done(buffer)
    }, function (e) {
      reject('DecodeAudioData error', e)
    })
  })
}

/**
 *  Parse the SoundFont data and return a JSON object
 *  (SoundFont data are .js files wrapping json data)
 *
 * @param {String} data - the SoundFont js file content
 * @return {JSON} the parsed data as JSON object
 * @private
 */
function parseJavascript (data) {
  var begin = data.indexOf('MIDI.Soundfont.')
  begin = data.indexOf('=', begin) + 2
  var end = data.lastIndexOf(',')
  var str = data.slice(begin, end) + '}'
  return JSON.parse(data.slice(begin))
}

/**
 * Wrap a http GET request into a Promise that resolves to the response content
 *
 * @param {String} url
 * @return {Promise} a promises that resolves to the url ressponse content
 * @private
 */
function getRequest (url) {
  return new Promise(function (done, reject) {
    var req = new window.XMLHttpRequest()
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
