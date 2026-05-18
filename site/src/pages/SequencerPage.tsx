import { useTitle } from "../useTitle";
import { StepGridSection } from "../sequencer/StepGridSection";
import { RatchetSection } from "../sequencer/RatchetSection";
import { MultiInstrumentSection } from "../sequencer/MultiInstrumentSection";
import { SongModeSection } from "../sequencer/SongModeSection";
import { LiveMixerSection } from "../sequencer/LiveMixerSection";

export function SequencerPage() {
  useTitle("smplr — sequencer");
  return (
    <>
      <h1 className="text-4xl mb-2">Sequencer</h1>
      <p className="text-zinc-400 mb-12">
        Five short showcases of the smplr Sequencer's main capabilities.
      </p>
      <div className="flex flex-col gap-16">
        <section id="step-grid" className="scroll-mt-20">
          <StepGridSection />
        </section>
        <section id="ratchet" className="scroll-mt-20">
          <RatchetSection />
        </section>
        <section id="multi" className="scroll-mt-20">
          <MultiInstrumentSection />
        </section>
        <section id="song-mode" className="scroll-mt-20">
          <SongModeSection />
        </section>
        <section id="mixer" className="scroll-mt-20">
          <LiveMixerSection />
        </section>
      </div>
    </>
  );
}
