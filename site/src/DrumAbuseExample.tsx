import { useState } from "react";
import {
  DrumAbuse,
  getDrumAbusePackNames,
  getDrumAbuseMachinesForPack,
  Reverb,
} from "smplr";
import { getAudioContext } from "./audio-context";
import { LoadWithStatus, useStatus } from "./useStatus";

let reverb: Reverb | undefined;

const DEFAULT_MACHINE = "roland-tr-808";

export function DrumAbuseExample({ className }: { className?: string }) {
  const { status, setStatus, progress, onLoadProgress } = useStatus();
  const [machine, setMachine] = useState(DEFAULT_MACHINE);
  const [drums, setDrums] = useState<DrumAbuse | undefined>(undefined);
  const [reverbMix, setReverbMix] = useState(0.0);
  const [volume, setVolume] = useState(100);
  const [reversedGroups, setReversedGroups] = useState<Set<string>>(new Set());

  function toggleReverse(group: string) {
    setReversedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  function load(machineId: string) {
    drums?.dispose();
    setStatus("loading");
    const context = getAudioContext();
    reverb ??= Reverb(context);
    const next = DrumAbuse(context, {
      source: { kind: "machine", machine: machineId },
      onLoadProgress,
    });
    next.output.addEffect("reverb", reverb, reverbMix);

    next.load
      .then(() => {
        setStatus("ready");
        setDrums(next);
      })
      .catch((err) => {
        setStatus("error");
        console.error("DrumAbuse error", err);
      });
  }

  return (
    <div className={className}>
      <div className="flex gap-2 items-end mb-2">
        <h1 className="text-3xl">DrumAbuse</h1>
        <LoadWithStatus
          status={status}
          progress={progress}
          onClick={() => load(machine)}
        />
      </div>
      <div
        className={status !== "ready" ? "opacity-30 no-select" : "no-select"}
      >
        <div className="flex gap-4 mb-2">
          <select
            className="appearance-none bg-zinc-700 text-zinc-200 rounded-sm border border-gray-400 py-2 px-3 leading-tight focus:outline-hidden focus:border-blue-500"
            value={machine}
            onChange={(e) => {
              const newMachine = e.target.value;
              if (newMachine !== machine) {
                setMachine(newMachine);
                load(newMachine);
              }
            }}
          >
            {getDrumAbusePackNames().map((pack) => (
              <optgroup key={pack} label={pack}>
                {getDrumAbuseMachinesForPack(pack).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </optgroup>
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
              const v = e.target.valueAsNumber;
              if (drums) drums.output.volume = v;
              setVolume(v);
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
              drums?.output.setEffectMix("reverb", mix);
              setReverbMix(mix);
            }}
          />
        </div>
        <div className="grid grid-cols-6 gap-1">
          {drums?.getGroupNames().map((group) => {
            const rev = reversedGroups.has(group);
            return (
              <div key={group} className="bg-zinc-900 rounded-sm px-2 pb-2">
                <div className="flex gap-1">
                  <button
                    className="text-left grow"
                    onClick={() => {
                      drums?.start({
                        note: group,
                        detune: 50 * (Math.random() - 0.5),
                        reverse: rev,
                      });
                    }}
                  >
                    {group}
                  </button>
                  <button
                    className={`text-xs px-1 rounded-sm ${rev ? "bg-rose-700 text-white" : "bg-zinc-700 text-zinc-400"}`}
                    onClick={() => toggleReverse(group)}
                    title="Toggle reverse playback"
                  >
                    Rev
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {drums?.getSampleNamesForGroup(group).map((sample) => (
                    <button
                      key={sample}
                      className="bg-zinc-600 w-4 h-4 rounded-sm"
                      onPointerDown={() => {
                        drums?.start({
                          note: sample,
                          reverse: rev,
                        });
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
