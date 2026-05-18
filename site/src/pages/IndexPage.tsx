import { ReactNode } from "react";
import { INSTRUMENTS, InstrumentGroup } from "../instruments";

const GROUPS: { id: InstrumentGroup; title: string }[] = [
  { id: "keyboards", title: "Keyboards" },
  { id: "general-midi", title: "General MIDI" },
  { id: "percussion", title: "Percussion" },
];

export function IndexPage() {
  return (
    <>
      {GROUPS.map(({ id, title }, groupIdx) => {
        const entries = INSTRUMENTS.filter((i) => i.group === id);
        if (entries.length === 0) return null;
        return (
          <div key={id}>
            <GroupHeader className={groupIdx === 0 ? "" : "mt-16"}>
              {title}
            </GroupHeader>
            <div className="flex flex-col gap-8 mt-4">
              {entries.map(({ slug, Component }) => (
                <section key={slug} id={slug} className="scroll-mt-20">
                  <Component />
                </section>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function GroupHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`text-zinc-400 text-xs uppercase tracking-widest border-b border-zinc-700 pb-2 ${className}`}
    >
      {children}
    </h2>
  );
}
