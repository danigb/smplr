## `mapRange`

process a map range






## `Sampler`

Create a sampler instrument

### Parameters

* `ac` **`AudioContect`** the audio contect
* `instrument` **`HashMap`** a sampler instrument definition. It contains:  - {HashMap} samples - (required) a map of names to audio buffers - {HashMap} midi - (optional) a hash map of midi notes to sample information



Returns `Object` a sampler instance. The sampler has the following methods:

- connect: connect the output of the sampler to an audio node
- play: play a sample
- note: get a sample player by note name or midi number
- sample: get a sampler player by a sampler name
- notes: get available note midi numbers
- samples: get available sample names


## `sampler.connect`

Connect the sample output to the destination

This method is chainable

### Parameters

* `destination` **`AudioNode`** 



Returns `Sampler` the sampler


## `sampler.note`

Get a player for a note

### Parameters

* `the` **`String`** note name or midi number



Returns `SamplePlayer` a sample player


## `sampler.notes`

Return the available midi note numbers




Returns  midi numbers


## `sampler.play`

Play a sample

A sugar function to get a sample player and start it. It accepts sample
names or midi numbers

### Parameters

* `name` **`String or Number`** the note name, midi number or sample name
* `when` **`Integer`** (Optional) the time to start playing
* `duration` **`Integer`** (Optional) the desired duration



Returns `Object` the triggered sample


## `sampler.sample`

Get a sample (player)

### Parameters

* `the` **`String`** sample name



Returns `SamplePlayer` a sample player


## `sampler.samples`

Return a list of available sample names




Returns  the sample names


