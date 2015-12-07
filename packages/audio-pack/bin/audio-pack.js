#!/usr/bin/env node

var fs = require('fs')
var path = require('path')
var stream = require('stream')

var args = process.argv.slice(2)

if (args.length > 1) {
  console.error('Too many arguments.')
  process.exit(1)
}

var filename = path.join(process.cwd(), args[0])
fs.readFile(filename, function (err, data) {
  if (err) throw Error(err)
  var ext = path.extname(filename).substring(1)
  var prefix = 'data:audio/' + ext + ';base64,'
  var encoded = new Buffer(data).toString('base64')
  var s = new stream.Readable()
  s.push(prefix + encoded)
  s.push(null)
  s.pipe(process.stdout)
})
