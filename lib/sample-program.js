'use strict'

/**
 * Create a SampleProgram
 */
module.exports = function SampleProgram (buffers, options) {
  var samples = Object.keys(buffers).reduce(function (samples, name) {
    samples[name] = { buffer: buffers[name], params: options }
    return samples
  }, {})
  return {
    keys: function () { return Object.keys(samples) },
    get: function (k) { return samples[k] }
  }
}
