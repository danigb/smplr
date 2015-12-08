var fs = {
  files: {},
  read: function (name) {
    return new Promise(function (done, reject) {
      if (name in fs.files) done(fs.files[name])
      else reject('File ' + name + ' not found.')
    })
  },
  addFile: function (name, value) {
    fs.files[name] = value
  },
  addBinaries: function () {
    var names = Array.prototype.slice.call(arguments)
    names.forEach(function (file) {
      fs.addFile(file, stringToArrayBuffer(file + ' audio content'))
    })
  }
}

// http://stackoverflow.com/questions/6965107/converting-between-strings-and-arraybuffers
function stringToArrayBuffer (str) {
  var buf = new ArrayBuffer(str.length * 2) // 2 bytes for each char
  var bufView = new Uint16Array(buf)
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}

module.exports = fs
