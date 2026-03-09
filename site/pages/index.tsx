import { Inter } from "next/font/google";
import Head from "next/head";
import pkg from "smplr/package.json";
const { version } = pkg;
import { DrumMachineExample } from "src/DrumMachineExample";
import { SequencerExample } from "src/SequencerExample";
import { ElectricPianoExample } from "src/ElectricPianoExample";
import { MalletExample } from "src/MalletExample";
import { MellotronExample } from "src/MellotronExample";
import { SmolkenExample } from "src/SmolkenExample";
import { Soundfont2Example } from "src/Soundfont2Example";
import { SoundfontExample } from "src/SoundfontExample";
import { VersilianExample } from "src/VersilianExample";
import { PianoExample } from "../src/PianoExample";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <>
      <Head>
        <title>smplr</title>
        <meta name="description" content="Plug and play web instruments" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className={"max-w-4xl mx-auto my-20 p-4" + inter.className}>
        <div className="flex items-end mb-16">
          <h1 className="text-6xl font-bold">smplr</h1>
          <span className="text-zinc-500 ml-3 text-lg">{version}</span>
        </div>

        <div className="flex flex-col gap-8">
          <PianoExample />
          <SoundfontExample />
          <ElectricPianoExample />
          <MalletExample />
          <DrumMachineExample />
          <SequencerExample />
          <MellotronExample />
          <SmolkenExample />
          <VersilianExample />
          <Soundfont2Example />
        </div>
      </main>
    </>
  );
}
