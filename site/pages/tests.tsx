import { Inter } from "next/font/google";
import Head from "next/head";
import { useEffect, useRef } from "react";
import { Sampler } from "smplr";
import { getAudioContext } from "src/audio-context";

const inter = Inter({ subsets: ["latin"] });

export default function Tests() {
  const samplerRef = useRef<Sampler | null>(null);

  useEffect(() => {
    const audioContext = getAudioContext();
    const sampler = new Sampler(audioContext, {
      buffers: { test: "test.mp3" },
    });
    samplerRef.current = sampler;
  }, []);

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
        </div>

        <div>
          <button
            onClick={() => {
              samplerRef.current?.start({
                note: "test",
                loop: true,
                loopStart: 1.0,
                loopEnd: 9.0,
              });
            }}
          >
            Play
          </button>
        </div>
      </main>
    </>
  );
}
