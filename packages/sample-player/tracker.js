'use strict'

function Tracker (polyphony) {
  var nextId = 0
  var tracked = []

  function tracker () {}
  tracker.track = function (source) {
    source.id = nextId++
    source.onended = onended
    tracked[source.id] = source
  }

  tracker.stop = function (when) {
    when = when || 0
    Object.keys(tracked).forEach(function (id) {
      tracked[id].stop(when)
      delete tracked[id]
    })
  }

  function onended (e) {
    var source = e.target
    source.stop()
    source.disconnect()
    delete tracked[source.id]
  }
  return tracker
}

module.exports = Tracker
