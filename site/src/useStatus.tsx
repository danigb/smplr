import { useCallback, useState } from "react";

export type Status = "init" | "loading" | "ready" | "error";

export function useStatus() {
  const [status, setStatus] = useState<Status>("init");
  const [progress, setProgress] = useState("");

  const onLoadProgress = useCallback(
    (p: { loaded: number; total: number }) => {
      setProgress(
        p.total > 0 ? `${Math.round((100 * p.loaded) / p.total)}%` : ""
      );
    },
    []
  );

  return { status, setStatus, progress, onLoadProgress } as const;
}

export type SampleFormat = "ogg" | "m4a";

export function LoadWithStatus({
  status,
  onClick,
  progress,
  format,
  onFormatChange,
}: {
  status: string;
  onClick: () => void;
  progress?: string;
  format?: SampleFormat;
  onFormatChange?: (format: SampleFormat) => void;
}) {
  return status === "init" ? (
    <div className="flex gap-2 items-center">
      <button
        className="text-rose-700 bg-zinc-900 px-2 rounded"
        onClick={onClick}
      >
        Load
      </button>
      {onFormatChange && (
        <select
          className="bg-zinc-900 text-zinc-400 text-sm px-1 rounded"
          value={format}
          onChange={(e) => onFormatChange(e.target.value as SampleFormat)}
        >
          <option value="ogg">ogg</option>
          <option value="m4a">m4a</option>
        </select>
      )}
    </div>
  ) : status === "ready" ? (
    <div className="flex gap-2 items-center">
      <div className="text-teal-600">Ready</div>
      {format && <div className="text-zinc-500 text-sm">({format})</div>}
    </div>
  ) : status === "loading" ? (
    <div className="text-gray-500">Loading{progress ? ` ${progress}` : "..."}</div>
  ) : (
    <div className="text-red-700">Error loading</div>
  );
}
