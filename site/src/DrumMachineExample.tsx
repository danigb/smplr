import { useState } from "react";
import { DrumMachine, getDrumMachineNames, Reverb } from "smplr";
import { getAudioContext } from "./audio-context";
import { LoadWithStatus, useStatus } from "./useStatus";

let reverb: Reverb | undefined;

export function DrumMachineExample({ className }: { className?: string }) {
  const [status, setStatus] = useStatus();
  const [dmName, setDmName] = useState(getDrumMachineNames()[0]);
  const [drums, setDrumMachine] = useState<DrumMachine | undefined>(undefined);
  const [reverbMix, setReverbMix] = useState(0.0);
  const [volume, setVolume] = useState(100);

  function loadDrumMachine(instrument: string) {
    setStatus("loading");
    const context = getAudioContext();
    reverb ??= new Reverb(context);
    const drums = new DrumMachine(context, { instrument });
    drums.output.addEffect("reverb", reverb, reverbMix);

    drums.load
      .then(() => {
        setStatus("ready");
        setDrumMachine(drums);
      })
      .catch((err) => {
        setStatus("error");
        console.error("Instrument error", err);
      });
  }

  return (
    <div className={className}>
      <div className="flex gap-2 items-end mb-2">
        <h1 className="text-3xl">DrumMachine</h1>
        <LoadWithStatus
          status={status}
          onClick={() => {
            loadDrumMachine(dmName);
          }}
        />
      </div>
      <div
        className={status !== "ready" ? "opacity-30 no-select" : "no-select"}
      >
        <div className="flex gap-4 mb-2">
          <select
            className="appearance-none bg-zinc-700 text-zinc-200 rounded border border-gray-400 py-2 px-3 leading-tight focus:outline-none focus:border-blue-500"
            value={dmName}
            onChange={(e) => {
              const newName = e.target.value;
              if (newName !== dmName) {
                setDmName(newName);
                loadDrumMachine(newName);
              }
            }}
          >
            {getDrumMachineNames().map((dmName) => (
              <option key={dmName} value={dmName}>
                {dmName}
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
          {drums?.getGroupNames().map((group) => (
            <div key={group} className="bg-zinc-900 rounded px-2 pb-2">
              <div className="flex">
                <button
                  className="text-left flex-grow"
                  onClick={() => {
                    drums?.start({
                      note: group,
                      detune: 50 * (Math.random() - 0.5),
                    });
                  }}
                >
                  {group}
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {drums?.getSampleNamesForGroup(group).map((sample) => (
                  <button
                    key={sample}
                    className="bg-zinc-600 w-4 h-4 rounded"
                    onPointerDown={() => {
                      drums?.start({
                        note: sample,
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
