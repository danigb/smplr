import type { ComponentType } from "react";
import { PianoExample } from "src/PianoExample";
import { SoundfontExample } from "src/SoundfontExample";
import { Soundfont2Example } from "src/Soundfont2Example";
import { ElectricPianoExample } from "src/ElectricPianoExample";
import { MalletExample } from "src/MalletExample";
import { MellotronExample } from "src/MellotronExample";
import { SmolkenExample } from "src/SmolkenExample";
import { VersilianExample } from "src/VersilianExample";
import { DrumMachineExample } from "src/DrumMachineExample";
import { DrumAbuseExample } from "src/DrumAbuseExample";

export type InstrumentGroup = "keyboards" | "general-midi" | "percussion";

export type InstrumentEntry = {
  slug: string;
  group: InstrumentGroup;
  Component: ComponentType<{ className?: string }>;
};

export const INSTRUMENTS: InstrumentEntry[] = [
  { slug: "piano", group: "keyboards", Component: PianoExample },
  {
    slug: "electric-piano",
    group: "keyboards",
    Component: ElectricPianoExample,
  },
  { slug: "mallet", group: "keyboards", Component: MalletExample },
  { slug: "mellotron", group: "keyboards", Component: MellotronExample },
  { slug: "smolken", group: "keyboards", Component: SmolkenExample },
  { slug: "soundfont", group: "general-midi", Component: SoundfontExample },
  { slug: "soundfont2", group: "general-midi", Component: Soundfont2Example },
  { slug: "versilian", group: "general-midi", Component: VersilianExample },
  {
    slug: "drum-machine",
    group: "percussion",
    Component: DrumMachineExample,
  },
  {
    slug: "drum-abuse",
    group: "percussion",
    Component: DrumAbuseExample,
  },
];
