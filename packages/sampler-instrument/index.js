'use strict'

var toMidi = require('note.midi')
var player = require('sample-player')

/**
* Create a sampler
*
* It uses an audio context and an instrument props.
*
* @param {AudioContect} ac - the audio contect
* @param {Object} props - the instrument properties
* @return {Sampler} a sampler instance
*/
function Sampler (ac, props) {
  if (arguments.length === 1) return function (p) { return Sampler(ac, p) }
  if (!(this instanceof Sampler)) return new Sampler(ac, props)

  // private
  props.notes = props.notes || mapNotes(props.samples)
  var players = {}
  var output = ac.createGain()

  // instance
  var sampler = {}

  /**
  * Connect the sample output to the destination
  *
  * This method is chainable
  *
  * @param {AudioNode} destination
  * @return {Sampler} the sampler
  */
  sampler.connect = function (destination) {
    output.connect(destination)
    return sampler
  }

  /**
   * Play a sample
   *
   * A sugar function to get a sample player and start it. It accepts sample
   * names or midi numbers
   *
   * @param {String|Number} sample - the sample name or midi number
   * @param {Integer} when - (Optional) the time to start playing
   * @param {Integer} duration - (Optional) the desired duration
   * @return {Object} the buffer player
   */
  sampler.play = function (sample, when, duration) {
    var player = sampler.sample(sample) || sampler.note(sample)
    if (!player) return null
    if (typeof when !== 'undefined') {
      when = when || ac.currentTime
      player.start(when)
      if (typeof duration !== 'undefined' && duration >= 0) player.stop(when + duration)
    }
    return player
  }

  /**
  * Get a sample (player)
  *
  * @param {String} the sample name
  * @return {SamplePlayer} a sample player
  */
  sampler.sample = function (name) {
    if (players[name]) return players[name]
    var buffer = props.samples[name]
    if (!buffer) return null
    players[name] = player(ac, buffer).connect(output)
    return players[name]
  }

  /**
  * Return a list of available sample names
  *
  * @return {Array<String>} the sample names
  */
  sampler.samples = function () { return Object.keys(props.samples) }

  /**
  * Get a note (player)
  *
  * @param {String} the note name or midi number
  * @return {SamplePlayer} a sample player
  */
  sampler.note = function (note) {
    var midi = toMidi(note)
    if (players[midi]) return players[midi]
    var buffer = props.samples[props.notes[midi]]
    if (!buffer) return null
    players[midi] = player(ac, buffer).connect(output)
    return players[midi]
  }

  /**
  * Return the midi available midi note numbers
  * @return {Array<Number>} midi numbers
  */
  sampler.notes = function () { return Object.keys(props.notes) }
  return sampler
}

function mapNotes (samples) {
  var midi
  return Object.keys(samples).reduce(function (notes, name) {
    if ((midi = toMidi(name))) notes[midi] = name
    return notes
  }, {})
}

module.exports = Sampler
