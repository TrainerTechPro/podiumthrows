"use client";

import { Sheet } from "@/components/ui/Sheet";
import type { HistoryThrow } from "@/lib/throws/history-types";
import { useUnitPref } from "@/lib/units/provider";

export interface HistoryDrillThrowsSheetProps {
  open: boolean;
  onClose: () => void;
  drillTypeLabel: string | null;
  implementLabel: string;
  bestThrowLogId: string | null;
  throws: HistoryThrow[];
  onPickThrow: (t: HistoryThrow) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][d.getMonth()];
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${month} ${d.getDate()}, ${time}`;
}

export function HistoryDrillThrowsSheet({
  open,
  onClose,
  drillTypeLabel,
  implementLabel,
  bestThrowLogId,
  throws,
  onPickThrow,
}: HistoryDrillThrowsSheetProps) {
  const title = `${drillTypeLabel ?? "Free log"} · ${implementLabel}`;
  const { format: formatDist } = useUnitPref("throwDistance");

  return (
    <Sheet open={open} onClose={onClose} side="bottom" size="lg" title={title} ariaLabel={title}>
      <ul className="divide-y divide-[var(--card-border)]">
        {throws.map((t) => {
          const isPR = t.id === bestThrowLogId;
          const throwLabel = `#${t.throwNumber ?? "?"}`;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPickThrow(t)}
                aria-label={`Edit throw ${throwLabel}`}
                className="w-full flex items-center gap-3 py-3 px-1 min-h-[44px] text-left active:scale-[0.99] motion-reduce:active:scale-100 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              >
                <span className="font-mono tabular-nums text-sm font-semibold text-[var(--foreground)] w-10 shrink-0">
                  {throwLabel}
                </span>
                <span className="text-xs text-muted shrink-0 w-32">
                  {formatTime(t.performedAt)}
                </span>
                <span className="font-mono tabular-nums text-base font-semibold text-[var(--foreground)] flex-1 text-right">
                  {t.distance != null ? formatDist(t.distance) : "—"}
                </span>
                {t.isFoul && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger-500/15 text-danger-500 tracking-wider shrink-0">
                    FOUL
                  </span>
                )}
                {isPR && (
                  <span className="text-primary-500 text-base shrink-0" aria-label="Personal best">
                    ★
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
