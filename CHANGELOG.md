# smplr

## 0.10.0

- Feature: Versilian VCSL instrument (not fully implemented)

## 0.9.0

- Feature: Support for SFZ file parsing
- Feature: New Smolken double bass instrument

## 0.8.1

- Fix: soundfont.loop returns this
- Improvement: Soundfont uses group abstraction. Simplify code

## 0.8.0

- Feature: New Mellotron instrument
- Deprecation: : use `load` property instead of `loaded()` function

## 0.7.0

- Feature: Soundfont can play looped instruments using new loadLoopData option
- Feature: New sample player accepts a very large number of notes
- Feature: `loop`, `loopStart` and `loopEnd` has been added as sample start options
- Fix: Can't disconnect a player or channel twice

## 0.6.1

- Fix: error with HttpStorage fetch binding

## 0.6.0

- Feature: Add `CacheStorage` object for caching http requests

## 0.5.1

- Fix: Ensure `options` is optional when possible

## 0.5.0

- Feature: Add `onEnded` property to the start note object

## 0.4.3

- Fix: Rename `getSoundfontInstrumentNames` to `getSoundfontNames` to keep naming consistency

## 0.4.2

- Fix: Ensure mp3 Soundfonts are loaded in Safari

## 0.4.1

- Fix: Accept note name in SplendidGrandPiano
- Fix: Show a console.warning if the buffer is not found

## 0.4.0

- Feature: Add DrumMachine instrument

## 0.3.0

Full rewrite. Samples stored at https://github.com/danigb/samples
