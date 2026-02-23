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

export function LoadWithStatus({
  status,
  onClick,
  progress,
}: {
  status: string;
  onClick: () => void;
  progress?: string;
}) {
  return status === "init" ? (
    <button
      className="text-rose-700 bg-zinc-900 px-2 rounded"
      onClick={onClick}
    >
      Load
    </button>
  ) : status === "ready" ? (
    <div className="text-teal-600">Ready</div>
  ) : status === "loading" ? (
    <div className="text-gray-500">Loading{progress ? ` ${progress}` : "..."}</div>
  ) : (
    <div className="text-red-700">Error loading</div>
  );
}
