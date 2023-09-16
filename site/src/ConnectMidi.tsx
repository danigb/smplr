import { useEffect, useRef, useState } from "react";
import { Listener, WebMidi } from "webmidi";

function supportsMidi() {
  return (
    typeof window !== "undefined" &&
    typeof window.navigator !== "undefined" &&
    navigator.requestMIDIAccess !== undefined
  );
}

export type MidiInstrument = {
  start(note: { note: number; velocity: number }): void;
  stop(note: { stopId: number }): void;
};

export function ConnectMidi({
  instrument,
}: {
  instrument: MidiInstrument | undefined;
}) {
  const inst = useRef<MidiInstrument | null>(null);
  const [midiDeviceNames, setMidiDeviceNames] = useState<string[]>([]);
  const [midiDeviceName, setMidiDeviceName] = useState("");
  const [disconnectMidiDevices, setDisconnectMidiDevices] = useState<
    Listener[] | undefined
  >();
  const [lastNote, setLastNote] = useState("");

  useEffect(() => {
    if (!supportsMidi()) return;
    WebMidi.enable().then(() => {
      const deviceNames = WebMidi.inputs.map((device) => device.name);
      setMidiDeviceNames(deviceNames);
    });
  }, []);

  inst.current = instrument ?? null;

  const isConnected = disconnectMidiDevices !== undefined;

  function disconnectMidi() {
    disconnectMidiDevices?.forEach((listener) => listener.remove());
    setDisconnectMidiDevices(undefined);
    return;
  }

  function connectMidi(deviceName: string) {
    const device = WebMidi.inputs.find((device) => device.name === deviceName);
    if (!device) {
      setMidiDeviceName("");
      return;
    }

    setMidiDeviceName(deviceName);
    const listener = device.addListener("noteon", (event) => {
      const noteOn = {
        note: event.note.number,
        velocity: (event as any).rawVelocity,
      };
      inst.current?.start(noteOn);
      setLastNote(`${noteOn.note} (${noteOn.velocity})`);
    });
    const listenerOff = device.addListener("noteoff", (event) => {
      inst.current?.stop({ stopId: event.note.number });
      setLastNote("");
    });

    setDisconnectMidiDevices([
      ...(Array.isArray(listener) ? listener : [listener]),
      ...(Array.isArray(listenerOff) ? listenerOff : [listenerOff]),
    ]);
  }

  return (
    <>
      <button
        className={
          "px-1 rounded " + (isConnected ? "bg-emerald-600" : "bg-zinc-700")
        }
        onClick={() => {
          if (isConnected) {
            disconnectMidi();
          } else {
            connectMidi(midiDeviceName);
          }
        }}
      >
        MIDI
      </button>
      <select
        className="appearance-none bg-zinc-700 text-zinc-200 rounded border border-gray-400 py-2 px-3 leading-tight focus:outline-none focus:border-blue-500 py-[2px]"
        value={midiDeviceName}
        onChange={(e) => {
          const name = e.target.value;
          if (isConnected) {
            disconnectMidi();
          }
          if (name) {
            connectMidi(name);
          }
        }}
      >
        <option value="">Select MIDI device</option>
        {midiDeviceNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <div className="opacity-50">{lastNote}</div>
    </>
  );
}
