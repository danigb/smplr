/* global AudioContext */
'use strict'

console.log(document.location)
if (document.location.pathname === '/') document.location.pathname = '/example'

var ac = new AudioContext()

var h = require('hyperscript')
var all = require('../drum-machines.json')
var load = require('../../sample-loader')(ac)
var sampler = require('../../sampler-instrument')(ac)

var styles = {
  container: { width: '100%', overflow: 'hidden' }
}

function loadDM (ui, name) {
  ui.innerHTML = 'Loading ' + name + '...'
  load(name + '/' + name + '.json').then(function (props) {
    var dm = sampler(props).connect(ac.destination)
    console.log('props', props)
    ui.innerHTML = ''
    ui.appendChild(Machine(dm))
  })
}

function init () {
  var machine = document.createElement('div')
  document.body.appendChild(Header())
  document.body.appendChild(Instruments(machine))
  document.body.appendChild(machine)
  loadDM(machine, 'MRK-2')
}
init()

function Header () {
  return h('div', [h('h2', 'drum-machines'), h('h1', 'Example')])
}

function Instruments (ui) {
  function selector (name) {
    var style = { float: 'left', 'margin-right': '1em' }
    return h('div', h('a', { href: '#', style: style,
      onclick: function () { loadDM(ui, name) }
    }, name))
  }
  return h('div#instruments', [h('h4', 'Available instruments: '),
    h('div', { style: styles.container }, all.map(selector))])
}

function Machine (dm) {
  function sampleRow (sample) {
    return row(sample, function (e) {
      dm.play(sample)
      e.preventDefault()
    }, function (e) {

    })
  }
  function randomRow () {
    return row('random', null, null)
  }
  function row (name, nameclick, slotclick) {
    return h('div.row', { style: styles.container },
      [ h('a.name', { href: '#', onclick: nameclick }, name) ]
        .concat(Slots(slotclick)))
  }
  return h('div#machine', [h('h3', dm.props.name),
    h('div#controls'),
    h('div#rows', [ randomRow() ].concat(dm.samples().sort().map(sampleRow)))
  ])
}

function Slots () {
  var slots = []
  for (var i = 0; i < 16; i++) {
    slots.push(h('a.slot', { href: '#' }, i))
  }
  return slots
}
