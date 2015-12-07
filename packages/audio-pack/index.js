var fs = require('fs')
var path = require('path')

/**
 * Encode an audio file using base64
 */
function encode (filename) {
  var ext = path.extname(filename)
  var data = fs.readFileSync(filename)
  var prefix = 'data:audio/' + ext.substring(1) + ';base64,'
  var encoded = new Buffer(data).toString('base64')
  return prefix + encoded
}

/**
 * Return the extension of a filename if its a valid web audio format extension
 */
function audioExt (name) {
  var ext = path.extname(name)
  return ['.wav', '.ogg', '.mp3'].indexOf(ext) > -1 ? ext : null
}

/**
 * Build a JSON packed file from the instrument.json file
 */
function build (instFile) {
  var dir = path.dirname(instFile)
  var inst = JSON.parse(fs.readFileSync(instFile))
  var samplesFile = path.join(dir, inst.name + '.samples.json')
  var samples = JSON.parse(fs.readFileSync(samplesFile))
  inst.samples = samples
  return JSON.stringify(inst, null, 2)
}

/**
 * Return a JSON with the audio files from a path encoded in base64
 */
function samples (samplesPath) {
  var files = fs.readdirSync(samplesPath).reduce(function (d, name) {
    var ext = audioExt(name)
    if (ext) d[name.substring(0, name.length - ext.length)] = name
    return d
  }, {})
  var names = Object.keys(files)
  var prefix = sharedStart(names)
  var len = prefix.length
  var samples = names.reduce(function (s, name) {
    s[name.substring(len)] = encode(path.join(samplesPath, files[name]))
    return s
  }, {})
  return JSON.stringify(samples, null, 2)
}

// http://stackoverflow.com/questions/1916218/find-the-longest-common-starting-substring-in-a-set-of-strings/1917041#1917041
function sharedStart (array) {
  var A = array.concat().sort()
  var a1 = A[0]
  var a2 = A[A.length - 1]
  var L = a1.length
  var i = 0
  while (i < L && a1.charAt(i) === a2.charAt(i)) i++
  return a1.substring(0, i)
}

module.exports = {
  audioExt: audioExt,
  encode: encode,
  samples: samples,
  build: build
}
