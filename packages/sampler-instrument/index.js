'use strict'

var toMidi = require('note.midi')
var player = require('sample-player')

/**
* Create a sampler instrument
*
* @name Sampler
* @class Sampler
* @param {AudioContect} ac - the audio contect
* @param {HashMap} instrument - a sampler instrument definition. It contains:
*
* - {HashMap} samples - (required) a map of names to audio buffers
* - {HashMap} midi - (optional) a hash map of midi notes to sample information
*
* @return {Object} a sampler instance. The sampler has the following methods:
*
* - connect: connect the output of the sampler to an audio node
* - play: play a sample
* - note: get a sample player by note name or midi number
* - sample: get a sampler player by a sampler name
* - notes: get available note midi numbers
* - samples: get available sample names
*/
function Sampler (ac, inst) {
  if (arguments.length === 1) return function (p) { return Sampler(ac, p) }
  if (!inst.samples) throw Error("Sampler instrument must contain 'samples' hash map: " + JSON.stringify(inst, 2, null))

  // private
  var props = {}
  props.samples = clone(null, inst.samples)
  props.midi = midiMapToNotes(inst.midi, props.samples) || samplesToNotes(props.samples)
  var players = {}
  var output = ac.createGain()

  // instance
  var sampler = { props: props }

  /**
  * Connect the sample output to the destination
  *
  * This method is chainable
  *
  * @name sampler.connect
  * @function
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
   * @name sampler.play
   * @function
   * @param {String|Number} name - the note name, midi number or sample name
   * @param {Integer} when - (Optional) the time to start playing
   * @param {Integer} duration - (Optional) the desired duration
   * @return {Object} the triggered sample
   */
  sampler.play = function (name, when, duration) {
    var player = sampler.note(name) || sampler.sample(name)
    if (!player) return null
    when = when || ac.currentTime
    var trigger = player.start(when)
    if (typeof duration !== 'undefined' && duration >= 0) {
      trigger.stop(when + duration)
    }
    return trigger
  }

  /**
  * Get a sample (player)
  *
  * @name sampler.sample
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
  * @name sampler.samples
  * @return {Array<String>} the sample names
  */
  sampler.samples = function () { return Object.keys(props.samples) }

  /**
  * Get a player for a note
  *
  * @name sampler.note
  * @param {String} the note name or midi number
  * @return {SamplePlayer} a sample player
  */
  sampler.note = function (name) {
    var midi = toMidi(name)
    if (players[midi]) return players[midi]
    var note = props.midi[midi]
    if (!note) return null
    var buffer = props.samples[note.sample]
    players[midi] = player(ac, buffer, note).connect(output)
    return players[midi]
  }

  /**
  * Return the available midi note numbers
  *
  * @name sampler.notes
  * @function
  * @return {Array<Number>} midi numbers
  */
  sampler.notes = function () { return Object.keys(props.midi) }
  return sampler
}

var MIDI_PROPS = ['sample']
function midiMapToNotes (midiMap, samples) {
  if (!midiMap) return null
  var props, midi
  return Object.keys(midiMap).reduce(function (notes, name) {
    props = midiMap[name]
    if (!props.sample) throw Error('midi MUST contain a "sample" value: ', notes)
    if (!samples[props.sample]) throw Error('Sample ' + props.sample + ' not found: ', JSON.stringify(samples, null, 2))

    midi = toMidi(name)
    if (midi) notes[midi] = clone(MIDI_PROPS, props)
    else mapRange(notes, name, props)
    return notes
  }, {})
}

/**
 * process a map range
 */
function mapRange (notes, name, props) {
  var split = name.split(/\s*-\s*/)
  if (split.length !== 2) return
  var a = toMidi(split[0])
  var b = toMidi(split[1])
  if (!a || !b) throw Error('Invalid midi range: ' + name)
  var tone = toMidi(props.tone) || a
  for (var i = a; i <= b; i++) {
    notes[i] = clone(MIDI_PROPS, props)
    notes[i].detune = (i - tone) * 100
  }
}

function clone (keys, src) {
  var val
  keys = keys || Object.keys(src)
  return keys.reduce(function (props, key) {
    val = src[key]
    if (typeof val !== 'undefined') props[key] = val
    return props
  }, {})
}

function samplesToNotes (samples) {
  var midi
  return Object.keys(samples).reduce(function (notes, name) {
    if ((midi = toMidi(name))) notes[midi] = { sample: name }
    return notes
  }, {})
}

module.exports = Sampler
