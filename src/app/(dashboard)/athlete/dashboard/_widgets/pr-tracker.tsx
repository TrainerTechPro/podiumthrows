import Link from "next/link";
import { Trophy, Target } from "lucide-react";
import { AnimatedNumber } from "@/components";
import type { PRTrackerData } from "@/lib/data/dashboard-progress";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  const labels: Record<string, string> = {
    SHOT_PUT: "Shot",
    DISCUS: "Discus",
    HAMMER: "Hammer",
    JAVELIN: "Javelin",
  };
  return labels[event] ?? event;
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/* ─── Widget ─────────────────────────────────────────────────────────────── */

export function PRTrackerWidget({ data }: { data: PRTrackerData }) {
  return (
    <div className="card py-1 shadow-sm md:hover:shadow-md md:transition-shadow">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          PR Tracker
        </h3>
        <Link href="/athlete/throws/history" className="text-xs text-primary-500 hover:underline">
          All throws &gt;
        </Link>
      </div>

      {data.rows.length === 0 ? (
        <div className="flex flex-col items-center text-center py-10 px-4 gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
            <Trophy size={20} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
          </div>
          <div className="max-w-[260px]">
            <p className="text-sm font-semibold text-[var(--foreground)]">No PRs yet</p>
            <p className="text-xs text-muted mt-1">
              Log a throw with distance to start your first personal best.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[var(--card-border)]">
          {data.rows.map((row) => (
            <div key={row.throwLogId} className="px-4 py-3 flex items-center gap-3">
              {/* Implement chip */}
              <div className="w-14 shrink-0 text-center">
                <p className="text-xs font-bold text-[var(--foreground)] leading-tight">
                  {formatEventName(row.event)}
                </p>
                <p className="text-[11px] font-mono text-muted tabular-nums">
                  {row.implementWeight}kg
                </p>
              </div>

              {/* Distance */}
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  <AnimatedNumber value={row.distance} decimals={2} />
                  <span className="text-xs font-normal text-muted ml-0.5">m</span>
                </p>
                <p className="text-[11px] text-muted mt-0.5">{formatRelativeDate(row.date)}</p>
              </div>

              {/* Next target */}
              <div className="text-right shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1 justify-end">
                  <Target className="h-2.5 w-2.5" strokeWidth={1.75} aria-hidden="true" />
                  Next
                </p>
                <p className="text-sm font-mono tabular-nums text-[var(--foreground)] mt-0.5">
                  {row.nextTargetDistance.toFixed(2)}m
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
