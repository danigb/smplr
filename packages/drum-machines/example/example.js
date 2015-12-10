/* global AudioContext */
'use strict'
var ac = new AudioContext()

var h = require('hyperscript')
var all = require('../drum-machines.json')
var load = require('../../sample-loader')(ac)
var sampler = require('../../sampler-instrument')(ac)

var curry = function (fn) {
  return function (a, b) {
    if (arguments.length === 1) return function (b) { return fn(a, b) }
    else return fn(a, b)
  }
}

var styles = {
  container: { width: '100%', overflow: 'hidden' }
}

function init () {
  var machine = document.createElement('div')
  document.body.appendChild(Header())
  document.body.appendChild(Instruments(machine))
  document.body.appendChild(machine)
}
init()

function Header () {
  return h('div', [h('h2', 'drum-machines'), h('h1', 'Example')])
}

function Instruments (machine) {
  function selector (name) {
    var style = { float: 'left', 'margin-right': '1em' }
    return h('div', h('a', { href: '#', style: style,
      onclick: function () {
        machine.innerHTML = 'Loading ' + name + '...'
        load(name + '/' + name + '.json').then(function (props) {
          console.log('props', props)
          machine.innerHTML = ''
          var dm = sampler(props).connect(ac.destination)
          machine.appendChild(render.machine(dm))
        })
      }
    }, name))
  }
  return h('div#instruments', [h('h4', 'Available instruments: '),
    h('div', { style: styles.container }, all.map(selector))])
}

var render = {
  machine: function (dm) {
    return h('div#drum-machine', [h('h3', dm.props.name),
      h('div#controls'),
      h('div#rows', dm.samples().sort().map(render.row(dm)))])
  },
  row: curry(function (dm, sample) {
    return h('div#row', { style: styles.container }, [
      h('a', { href: '#', style: styles.inst,
        onclick: function (e) {
          dm.play(sample)
          e.preventDefault()
        }
      }, sample)
    ])
  })
}
