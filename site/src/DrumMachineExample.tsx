import { useState } from "react";
import { DrumMachine, DrumMachineInstruments, Reverb } from "smplr";
import { LoadWithStatus, useStatus } from "./useStatus";

let context: AudioContext | undefined;
let reverb: Reverb | undefined;
const kitNames = Object.keys(DrumMachineInstruments);

export function DrumMachineExample({ className }: { className?: string }) {
  const [status, setStatus] = useStatus();
  const [kitName, setKitName] = useState(kitNames[0]);
  const [drums, setDrumMachine] = useState<DrumMachine | undefined>(undefined);
  const [reverbMix, setReverbMix] = useState(0.0);
  const [volume, setVolume] = useState(100);

  function loadDrumMachine() {
    setStatus("loading");
    context ??= new window.AudioContext();
    reverb ??= new Reverb(context);
    const drums = new DrumMachine(context, { instrument: kitName });
    drums.output.addEffect("reverb", reverb, reverbMix);

    drums
      .loaded()
      .then(() => {
        setStatus("ready");
        setDrumMachine(drums);
      })
      .catch((err) => {
        setStatus("error");
        console.log("Instrument error", err);
      });
  }

  return (
    <div className={className}>
      <div className="flex gap-2 items-end mb-2">
        <h1 className="text-3xl">DrumMachine</h1>
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
          <select
            className="bg-zinc-700 rounded"
            value={kitName}
            onChange={(e) => {
              const newName = e.target.value;
              if (newName !== kitName) {
                setKitName(newName);
                loadDrumMachine();
              }
            }}
          >
            {kitNames.map((kitName) => (
              <option key={kitName} value={kitName}>
                {kitName}
              </option>
            ))}
          </select>
          <div>Vol:</div>
          <input
            type="range"
            min={0}
            max={127}
            step={1}
            value={volume}
            onChange={(e) => {
              const volume = e.target.valueAsNumber;
              drums?.output.setVolume(volume);
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
              drums?.output.sendEffect("reverb", mix);
              setReverbMix(mix);
            }}
          />
        </div>
        <div className="grid grid-cols-6 gap-1">
          {drums?.sampleNames.map((sample) => (
            <div key={sample} className="bg-zinc-900 rounded px-2 pb-2">
              <div className="flex">
                <button
                  className="text-left flex-grow"
                  onClick={() => {
                    drums?.start({
                      note: sample,
                      detune: 50 * (Math.random() - 0.5),
                    });
                  }}
                >
                  {sample}
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {drums?.getVariations(sample).map((variation) => (
                  <button
                    key={variation}
                    className="bg-zinc-600 w-4 h-4 rounded"
                    onMouseDown={() => {
                      drums?.start({
                        note: `${sample}/${variation}`,
                      });
                    }}
                  ></button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
