
function Tracker (polyphony) {
  if (!(this instanceof Tracker)) return new Tracker(polyphony)
  this.nextId = 0
  this.tracked = []
}
var proto = Tracker.prototype

proto.track = function (source) {
  source.id = this.nextId++
  source.onended = this.onended
  this.tracked[source.id] = source
}

proto.stop = function (when) {
  when = when || 0
  var tracked = this.tracked
  Object.keys(tracked).forEach(function (id) {
    tracked[id].stop(when)
    delete tracked[id]
  })
}

proto.onended = function (e) {
  var source = e.target
  source.stop()
  source.disconnect()
  delete this.tracked[source.id]
}

module.exports = Tracker
