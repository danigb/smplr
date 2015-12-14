'use strict'

var Tracker = require('./tracker')

/**
 * Create a sample player
 *
 * @name Player
 * @function
 * @param {AudioContext} ac - the web audio context
 * @param {AudioBuffer} buffer - the sample audio buffer
 * @param {HashMap} - an options map with any of this values:
 *
 * - loop: if the audio should be looped
 * - detune: the cents to detune the sample
 *
 * @return {Object} the sample player
 */
function SamplePlayer (ac, buffer, options) {
  if (arguments.length === 1) return function (b, o) { return SamplePlayer(ac, b, o) }
  if (!buffer) throw Error('AudioBuffer is required')

  options = options || {}
  var tracker = Tracker()
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
    tracker.track(source)
    source.start(when, offset, duration)

    return {
      source: source,
      stop: function (when) { source.stop(when) },
      start: player.start
    }
  }

  player.stop = function () { tracker.stop() }
  player.nodes = function () { return nodes }

  return player
}

/**
 * Get playback rate for a given pitch change (in cents)
 *
 * Basic [math](http://www.birdsoft.demon.co.uk/music/samplert.htm):
 * f2 = f1 * 2^( C / 1200 )
 * @private
 */
function centsToRate (cents) { return Math.pow(2, cents / 1200) }

if (typeof module === 'object' && module.exports) module.exports = SamplePlayer
if (typeof window !== 'undefined') window.SamplePlayer = SamplePlayer
