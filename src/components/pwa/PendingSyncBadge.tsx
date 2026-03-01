"use client";

import { CloudOff, Loader2 } from "lucide-react";

interface PendingSyncBadgeProps {
  count?: number;
  isSyncing?: boolean;
  /** Inline mode shows a small tag; header mode shows a larger pill. */
  variant?: "inline" | "header";
}

export function PendingSyncBadge({
  count = 0,
  isSyncing = false,
  variant = "inline",
}: PendingSyncBadgeProps) {
  if (count === 0 && !isSyncing) return null;

  if (variant === "header") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
        {isSyncing ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <CloudOff size={12} />
        )}
        {isSyncing
          ? "Syncing…"
          : `${count} pending sync`}
      </span>
    );
  }

  // inline variant — smaller, used per-attempt
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-900/25 text-amber-600 dark:text-amber-400">
      {isSyncing ? (
        <Loader2 size={9} className="animate-spin" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      )}
      {isSyncing ? "Syncing" : "Pending"}
    </span>
  );
}
