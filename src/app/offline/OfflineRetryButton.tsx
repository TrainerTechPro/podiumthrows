"use client";

import { RefreshCw } from "lucide-react";

export function OfflineRetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm"
    >
      <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
      Try again
    </button>
  );
}
