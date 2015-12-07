'use strict'

/**
 * Create a sample player
 * @param {AudioContext}
 * @param {AudioNode} destination - the destionation
 * @param {AudioBuffer} the audio buffer
 * @private
 */
function Player (ac, buffer, options) {
  console.log('Player', arguments)
  if (arguments.length === 1) return function (b, o) { return Player(ac, b, o) }

  options = options || {}
  var nextId = 0
  var tracked = {}
  var player = {}
  var gain = ac.createGain()

  player.connect = function (destination) { gain.connect(destination); return player }
  player.start = function (when, offset, duration) {
    when = when || ac.currentTime
    offset = offset || 0
    duration = duration || buffer.length - offset
    var source = ac.createBufferSource()
    source.buffer = buffer
    source.loop = options.loop || false
    source.connect(gain)
    track(source)
    source.start(when, offset, duration)

    return {
      stop: function (when) { source.stop() },
      start: player.start
    }
  }
  player.stop = function (when) {
    when = when || 0
    Object.keys(tracked).forEach(function (id) {
      tracked[id].stop(when)
      delete tracked[id]
    })
  }

  return player

  function track (source) {
    source.id = nextId++
    source.onended = bufferEnded
    tracked[source.id] = source
  }

  function bufferEnded (e) {
    var source = e.target
    source.stop()
    source.disconnect()
    delete tracked[source.id]
  }
}

if (typeof module === 'object' && module.exports) module.exports = Player
if (typeof window !== 'undefined') window.Player = Player
