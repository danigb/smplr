import { useState } from "react";

export type Status = "init" | "loading" | "ready" | "error";

export function useStatus() {
  return useState<Status>("init");
}

export function LoadWithStatus({
  status,
  onClick,
}: {
  status: string;
  onClick: () => void;
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
    <div className="text-gray-500">Loading...</div>
  ) : (
    <div className="text-red-700">Error loading</div>
  );
}
