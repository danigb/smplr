'use strict'

function instrument (buffers, options) {
  buffers = buffers || {}
  options = options || {}
  var samples = Object.keys(buffers).reduce(function (samples, name) {
    samples[name] = { buffer: buffers[name], options: options }
    return samples
  }, {})

  return {
    names: function () { return Object.keys(samples) },
    get: function (n) { return samples[n] }
  }
}

module.exports = instrument
