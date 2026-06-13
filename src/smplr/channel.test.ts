import { createAudioContextMock } from "../test-helpers";
import { Channel } from "./channel";

describe("Channel routing", () => {
  it("wires input → volume → panner → destination", () => {
    const mock = createAudioContextMock();
    new Channel(mock.context);

    const [input, volume] = mock.gains;
    const panner = mock.stereoPanners[0];

    expect(input.connected).toContain(volume);
    expect(volume.connected).toContain(panner);
    expect(panner.connected).toContain(mock.destination);
  });

  it("taps the send post-fader (from the volume node, not the input)", () => {
    const mock = createAudioContextMock();
    const channel = new Channel(mock.context);
    const [input, volume] = mock.gains;

    const effect = mock.context.createGain();
    const before = mock.gains.length;
    channel.addEffect("reverb", effect, 0.5);
    const mix = mock.gains[before]; // the gain created inside addEffect

    expect(volume.connected).toContain(mix); // post-fader: tapped after volume
    expect(input.connected).not.toContain(mix); // not pre-fader
    expect(mix.gain.value).toBe(0.5);
    expect(mix.connected).toContain(effect); // mix → effect input
  });

  it("inserts are upstream of the send tap (heard on the send)", () => {
    const mock = createAudioContextMock();
    const channel = new Channel(mock.context);
    const [input, volume] = mock.gains;

    const insert = mock.context.createGain();
    channel.addInsert(insert);
    // chain rebuilt: input → insert → volume → panner → destination
    expect(input.connected).toContain(insert);
    expect((insert as any).connected).toContain(volume);

    // The send still taps volume, so the insert (upstream of volume) reaches it.
    const effect = mock.context.createGain();
    const before = mock.gains.length;
    channel.addEffect("reverb", effect, 0.4);
    const mix = mock.gains[before];
    expect(volume.connected).toContain(mix);
  });
});
