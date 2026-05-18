import { useTitle } from "../useTitle";

export function DrumabusePage() {
  useTitle("smplr — drumabuse");
  return (
    <div>
      <h1 className="text-3xl">Drumabuse</h1>
      <p className="text-zinc-400 mt-4">
        Coming soon — a new drum-focused instrument.
      </p>
    </div>
  );
}
