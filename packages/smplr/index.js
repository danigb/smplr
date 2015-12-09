var loader = require('sample-loader')
var sampler = require('sampler-instrument')

function Samplr (ac, options) {
  if (!(this instanceof Samplr)) return new Samplr(ac, options)
  this.ac = ac
  this.instruments = []
  this.loader = loader(ac)
  this.nodes = {}

  this.output = ac.createGain()
  this.output.connect(ac.destination)
  this.autoConnect = true
}

Samplr.prototype.connect = function (destination) {
  if (this.autoConnect) {
    this.autoConnect = false
    this.output.disconnect()
  }
  this.output.connect(destination)
}

Samplr.prototype.load = function (source) {
  var self = this
  return this.loader(source).then(function (data) {
    var instrument = sampler(self.ac, data).connect(self.output)
    self.instruments.push(instrument)
    return instrument
  })
}

Samplr.prototype.stop = function (source) {
  this.instruments.forEach(function (inst) {
    inst.stop()
  })
}

if (typeof module === 'object' && module.exports) module.exports = Samplr
if (typeof window !== 'undefined') window.Samplr = Samplr
