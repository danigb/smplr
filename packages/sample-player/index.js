'use strict'

/**
 * Get playback rate for a given pitch change (in cents)
 *
 * Basic [math](http://www.birdsoft.demon.co.uk/music/samplert.htm):
 * f2 = f1 * 2^( C / 1200 )
 * @private
 */
function centsToRate (cents) { return Math.pow(2, cents / 1200) }

/**
 * Create a sample player
 *
 * It accepts the following options:
 *
 * - loop: if the audio should be looped
 * - detune: the cents to detune the sample
 *
 * @param {AudioContext}
 * @param {AudioNode} destination - the destionation
 * @param {AudioBuffer} the audio buffer
 */
function SamplePlayer (ac, buffer, options) {
  if (arguments.length === 1) return function (b, o) { return SamplePlayer(ac, b, o) }
  if (!buffer) throw Error('AudioBuffer is required')

  options = options || {}
  var nextId = 0
  var tracked = {}
  var player = {}
  var nodes = {}
  nodes.gain = ac.createGain()

  player.connect = function (destination) {
    nodes.gain.connect(destination)
    return player
  }

  player.start = function (when, offset, duration) {
    when = when || ac.currentTime
    offset = offset || 0
    duration = duration || buffer.length - offset
    var source = ac.createBufferSource()
    source.buffer = buffer
    source.loop = options.loop || false
    // Only works on chrome
    // source.detune.value = options.detune || 0
    source.playbackRate.value = centsToRate(options.detune || 0)
    source.loopStart = options.loopStart || 0
    source.loopEnd = options.loopEnd || 0
    source.connect(nodes.gain)
    track(source)
    source.start(when, offset, duration)

    return {
      source: source,
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
  player.nodes = function () { return nodes }

  return player

  function track (source) {
    source.id = nextId++
    source.onended = handleBufferEnded
    tracked[source.id] = source
  }

  function handleBufferEnded (e) {
    var source = e.target
    source.stop()
    source.disconnect()
    delete tracked[source.id]
  }
}

if (typeof module === 'object' && module.exports) module.exports = SamplePlayer
if (typeof window !== 'undefined') window.SamplePlayer = SamplePlayer
