## `connect`

Connect the sample output to the destination

This method is chainable

### Parameters

* `destination` **`AudioNode`** 



Returns `Sampler` the sampler


## `note`

Get a note (player)

### Parameters

* `the` **`String`** note name or midi number



Returns `SamplePlayer` a sample player


## `notes`

Return the midi available midi note numbers




Returns  midi numbers


## `play`

Play a sample

A sugar function to get a sample player and start it. It accepts sample
names or midi numbers

### Parameters

* `sample` **`String or Number`** the sample name or midi number
* `when` **`Integer`** (Optional) the time to start playing
* `duration` **`Integer`** (Optional) the desired duration



Returns `Object` the triggered sample


## `sample`

Get a sample (player)

### Parameters

* `the` **`String`** sample name



Returns `SamplePlayer` a sample player


## `Sampler`

Create a sampler

It uses an audio context and an instrument props.

### Parameters

* `ac` **`AudioContect`** the audio contect
* `props` **`Object`** the instrument properties



Returns `Sampler` a sampler instance


## `samples`

Return a list of available sample names




Returns  the sample names


