'use strict'

var loader = require('sample-loader')
var player = require('sample-player')
var Samples = require('./program')

function smplr (ac, program) {
  if (arguments.length === 1) return function (p) { return smplr(ac, p) }

  return Promise.resolve(program).then(function (program) {
    return sampler(ac, program)
  })
}
smplr.loader = loader

function sampler (ac, program) {
  var samples = Samples(program)
  var sampler = {}
  sampler.get = function (name) {
    var sample = samples.get(name)
    return sample ? player(ac, sample.buffer, sample.params) : null
  }
  sampler.keys = samples.keys
  return sampler
}

module.exports = smplr
