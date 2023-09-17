import { useState } from "react";
import { Reverb, Sampler } from "smplr";
import { getAudioContext } from "./audio-context";
import { LoadWithStatus, useStatus } from "./useStatus";

let reverb: Reverb | undefined;

const samples = [
  "crash",
  "hhclosed-1",
  "hhclosed-2",
  "hhopen-1",
  "hhopen-2",
  "kick",
  "ride",
  "snare-1",
  "snare-2",
  "snare-3",
  "tom-high",
  "tom-low",
  "tom-mid",
];

export function SamplerExample({ className }: { className?: string }) {
  const [status, setStatus] = useStatus();
  const [sampler, setSampler] = useState<Sampler | undefined>();
  const [reverbMix, setReverbMix] = useState(0.0);
  const [volume, setVolume] = useState(100);

  function loadDrumMachine() {
    setStatus("loading");
    const context = getAudioContext();
    reverb ??= new Reverb(context);
    const buffers = samples.reduce((samples, name) => {
      const url = `https://danigb.github.io/samples/drum-machines/808-mini/${name}.m4a`;
      samples[name] = url;
      return samples;
    }, {} as Record<string, string>);
    const sampler = new Sampler(context, { buffers });
    sampler.output.addEffect("reverb", reverb, reverbMix);

    sampler.load
      .then(() => {
        setStatus("ready");
        setSampler(sampler);
      })
      .catch((err) => {
        setStatus("error");
        console.error("Instrument error", err);
      });
  }

  return (
    <div className={className}>
      <div className="flex gap-2 items-end mb-2">
        <h1 className="text-3xl">Sampler</h1>
        <LoadWithStatus
          status={status}
          onClick={() => {
            loadDrumMachine();
          }}
        />
      </div>
      <div
        className={status !== "ready" ? "opacity-30 no-select" : "no-select"}
      >
        <div className="flex gap-4 mb-2">
          <div>Vol:</div>
          <input
            type="range"
            min={0}
            max={127}
            step={1}
            value={volume}
            onChange={(e) => {
              const volume = e.target.valueAsNumber;
              sampler?.output.setVolume(volume);
              setVolume(volume);
            }}
          />
          <div>Reverb:</div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={reverbMix}
            onChange={(e) => {
              const mix = e.target.valueAsNumber;
              sampler?.output.sendEffect("reverb", mix);
              setReverbMix(mix);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {samples.map((sample) => (
            <div key={sample} className="bg-zinc-700 rounded px-2">
              <div className="flex">
                <button
                  className="text-left flex-grow"
                  onClick={() => {
                    sampler?.start({
                      note: sample,
                    });
                  }}
                >
                  {sample}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
