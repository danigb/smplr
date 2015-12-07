var player = require('sample-player')

function Sampler (ac, props) {
  if (arguments.length === 1) return function (p) { return Sampler(ac, p) }

  var output = ac.createGain()
  var players = {}

  function sampler (name) {
    if (players[name]) return players[name]
    var buffer = props.samples[name]
    if (!buffer) {
      console.warn('Sample not found', name, props)
    }
    players[name] = player(ac, buffer).connect(output)
    return players[name]
  }
  sampler.connect = function (destination) {
    output.connect(destination)
    return sampler
  }
  return sampler
}

module.exports = Sampler
