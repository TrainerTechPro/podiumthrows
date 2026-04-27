"use client";

import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Read-only pill strip showing the full series at a glance ─────────────
   Sits between the hero (the *answer*) and the editor table (the *details*).
   The editor below remains the source of truth for editing — this strip is
   pure summary, so coaches glancing over an athlete's shoulder don't have
   to scan input chrome.
   ───────────────────────────────────────────────────────────────────── */

export interface SeriesThrow {
  id: string;
  round: "PRELIM" | "FINALS";
  attemptInRound: number;
  distance: number | null;
  isFoul: boolean;
  isPass: boolean;
}

interface SeriesAtAGlanceProps {
  throws: SeriesThrow[];
  /** ID of the best (max-distance, non-foul) throw — gets the medal. */
  bestThrowId: string | null;
}

function formatDistanceShort(n: number): string {
  return parseFloat(n.toFixed(2)).toString();
}

export function SeriesAtAGlance({ throws, bestThrowId }: SeriesAtAGlanceProps) {
  if (throws.length === 0) return null;

  // Group by round so PRELIM and FINALS render under their own headings —
  // matters for shot/discus where finals = top-9-only.
  const prelims = throws.filter((t) => t.round === "PRELIM");
  const finals = throws.filter((t) => t.round === "FINALS");

  return (
    <div
      className="card p-4 space-y-3"
      data-testid="series-at-a-glance"
      aria-label="Series summary"
    >
      <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">
        Series at a glance
      </p>
      {prelims.length > 0 && (
        <SeriesRow label="Prelims" throws={prelims} bestThrowId={bestThrowId} />
      )}
      {finals.length > 0 && <SeriesRow label="Finals" throws={finals} bestThrowId={bestThrowId} />}
    </div>
  );
}

function SeriesRow({
  label,
  throws,
  bestThrowId,
}: {
  label: string;
  throws: SeriesThrow[];
  bestThrowId: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {throws.map((t) => (
          <SeriesPill key={t.id} t={t} isBest={t.id === bestThrowId} />
        ))}
      </div>
    </div>
  );
}

function SeriesPill({ t, isBest }: { t: SeriesThrow; isBest: boolean }) {
  const isFoul = t.isFoul;
  const isPass = t.isPass;
  const isMark = !isFoul && !isPass && t.distance != null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono tabular-nums border",
        isBest
          ? "bg-primary-500/15 border-primary-500/40 text-[var(--foreground)]"
          : isFoul
            ? "bg-danger-500/10 border-danger-500/30 text-danger-600 dark:text-danger-400"
            : isPass
              ? "bg-surface-100 dark:bg-surface-800 border-transparent text-muted"
              : "bg-surface-100 dark:bg-surface-800 border-transparent text-[var(--foreground)]"
      )}
      aria-label={
        isFoul
          ? `Attempt ${t.attemptInRound}, foul${
              t.distance != null ? `, ${formatDistanceShort(t.distance)} meters` : ""
            }`
          : isPass
            ? `Attempt ${t.attemptInRound}, pass`
            : isBest
              ? `Attempt ${t.attemptInRound}, ${formatDistanceShort(t.distance!)} meters, best of meet`
              : `Attempt ${t.attemptInRound}, ${formatDistanceShort(t.distance!)} meters`
      }
    >
      <span className="text-[10px] text-muted font-mono">{t.attemptInRound}</span>
      {isBest && (
        <Trophy
          size={11}
          strokeWidth={1.75}
          className="text-primary-500 shrink-0"
          aria-hidden="true"
        />
      )}
      {isFoul ? (
        <>
          <span className="line-through opacity-80">
            {t.distance != null ? `${formatDistanceShort(t.distance)}m` : "—"}
          </span>
          <span className="text-[9px] uppercase tracking-wider font-semibold">Foul</span>
        </>
      ) : isPass ? (
        <span className="text-[10px] uppercase tracking-wider">Pass</span>
      ) : isMark ? (
        <span className={cn(isBest && "font-semibold")}>{formatDistanceShort(t.distance!)}m</span>
      ) : (
        <span className="text-[10px] uppercase tracking-wider text-muted">—</span>
      )}
    </span>
  );
}
