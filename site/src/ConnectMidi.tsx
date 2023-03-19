import dynamic from "next/dynamic";
import { MidiInstrument } from "./ConnectMidiClient";

const Midi = dynamic(
  () => import("./ConnectMidiClient").then((module) => module.ConnectMidi),
  {
    ssr: false,
  }
);

export function ConnectMidi(props: {
  shouldRenderComponent: boolean;
  instrument: MidiInstrument | undefined;
}) {
  const { shouldRenderComponent } = props;

  return shouldRenderComponent ? <Midi {...props} /> : null;
}
