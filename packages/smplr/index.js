var loader = require('sample-loader')
var sampler = require('sampler-instrument')

function Smplr (ac, options) {
  // private
  var load = loader(ac)
  var instruments = []
  var output = ac.createGain()
  output.connect(ac.destination)
  var autoConnected = true

  // instance
  var smplr = {}

  smplr.connect = function (destination) {
    if (autoConnected) {
      autoConnected = false
      output.disconnect()
    }
    output.connect(destination)
  }

  smplr.load = function (source) {
    return load(source).then(function (data) {
      var instrument = sampler(ac, data).connect(output)
      instruments.push(instrument)
      return instrument
    })
  }

  smplr.stop = function (source) {
    instruments.forEach(function (inst) {
      inst.stop()
    })
  }
  return smplr
}

if (typeof module === 'object' && module.exports) module.exports = Smplr
if (typeof window !== 'undefined') window.Smplr = Smplr
