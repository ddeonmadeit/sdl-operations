"use client";

import { RefreshCw } from "lucide-react";
import { useEffect } from "react";

export function ErrorView({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-16 text-center">
      <h2 className="text-lg font-semibold">That didn&apos;t load</h2>
      <p className="mt-1 text-sm text-muted">Check your signal and try again. Nothing you saved has been lost.</p>
      <button type="button" className="btn btn-primary mt-5" onClick={() => retry()}>
        <RefreshCw className="size-4" /> Try again
      </button>
    </div>
  );
}
