import * as React from "react";
import type { HistoryDrill } from "@/lib/throws/history-types";

interface Props {
  drill: HistoryDrill;
}

export function HistoryDrillRow({ drill }: Props) {
  const label = drill.drillTypeLabel
    ? `${drill.drillTypeLabel} · ${drill.implementLabel}`
    : `Free log · ${drill.implementLabel}`;
  const best = drill.bestMark != null ? `${drill.bestMark.toFixed(2)}m` : "—";

  return (
    <div
      className={`flex items-center justify-between py-1.5 text-sm ${
        drill.isPersonalBest ? "text-[var(--foreground)]" : "text-surface-700 dark:text-surface-300"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="font-mono tabular-nums font-semibold">
        {drill.throwCount} · {best}
        {drill.isPersonalBest && <span className="text-primary-500 ml-1" aria-label="Personal best">★</span>}
      </span>
    </div>
  );
}
