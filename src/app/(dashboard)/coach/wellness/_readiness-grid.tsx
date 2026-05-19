"use client";

import { useUrlState } from "@/lib/hooks/useUrlState";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle } from "lucide-react";
import { StaggeredList } from "@/components/ui/StaggeredList";
import type { TeamReadinessDetail } from "@/lib/data/coach";

/* ─── Constants ──────────────────────────────────────────────────── */

const EVENT_FILTERS = [
  { value: "ALL", label: "All Athletes" },
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
] as const;

const THRESHOLD = 5.0;

const CATEGORY_LABELS: Record<string, string> = {
  sleep: "Sleep",
  soreness: "Sore",
  stress: "Stress",
  energy: "Energy",
};

/* ─── Helpers ────────────────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 7) return "text-success-500";
  if (score >= 5) return "text-primary-500";
  return "text-danger-500";
}

function categoryBadgeColor(value: number): string {
  if (value >= 7) return "bg-success-500/10 text-success-600 dark:text-success-400";
  if (value >= 5) return "bg-primary-500/10 text-primary-600 dark:text-primary-400";
  return "bg-danger-500/10 text-danger-600 dark:text-danger-400";
}

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Sparkline Component ────────────────────────────────────────── */

function Sparkline({ history }: { history: { date: string; score: number }[] }) {
  const maxBars = 7;
  // Pad to 7 bars — fill missing days with null
  const bars: (number | null)[] = [];
  for (let i = 0; i < maxBars; i++) {
    bars.push(history[history.length - maxBars + i]?.score ?? null);
  }

  const barWidth = 4;
  const gap = 2;
  const height = 24;
  const svgWidth = maxBars * (barWidth + gap) - gap;

  return (
    <svg
      width={svgWidth}
      height={height}
      viewBox={`0 0 ${svgWidth} ${height}`}
      className="shrink-0"
      aria-label="7-day readiness trend"
      role="img"
    >
      {bars.map((score, i) => {
        if (score === null) {
          return (
            <rect
              key={i}
              x={i * (barWidth + gap)}
              y={height - 2}
              width={barWidth}
              height={2}
              rx={1}
              className="fill-surface-300 dark:fill-surface-700"
            />
          );
        }
        const barHeight = Math.max(2, (score / 10) * height);
        const fillClass =
          score >= 7 ? "fill-success-500" : score >= 5 ? "fill-primary-500" : "fill-danger-500";
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={1}
            className={fillClass}
          />
        );
      })}
    </svg>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */

export function ReadinessGrid({ athletes }: { athletes: TeamReadinessDetail[] }) {
  const [eventFilter, setEventFilter] = useUrlState("event", "ALL");

  const filtered =
    eventFilter === "ALL" ? athletes : athletes.filter((a) => a.events.includes(eventFilter));

  const flagged = filtered.filter((a) => a.latestScore !== null && a.latestScore < THRESHOLD);

  return (
    <>
      {/* Alert Banner */}
      {flagged.length > 0 && (
        <div className="rounded-xl border border-danger-500/20 bg-danger-500/10 p-4 flex items-start gap-3">
          <AlertTriangle
            size={18}
            strokeWidth={1.75}
            className="text-danger-500 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-danger-600 dark:text-danger-400">
              {flagged.length} athlete{flagged.length !== 1 ? "s" : ""} below readiness threshold
            </p>
            <p className="text-xs text-danger-600/80 dark:text-danger-400/80 mt-0.5 truncate">
              {flagged.map((a) => `${a.athleteName} (${a.latestScore?.toFixed(1)})`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* Event Group Filter */}
      <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-800/50 rounded-xl p-1 w-fit overflow-x-auto">
        {EVENT_FILTERS.map((ef) => {
          const count =
            ef.value === "ALL"
              ? athletes.length
              : athletes.filter((a) => a.events.includes(ef.value)).length;
          if (ef.value !== "ALL" && count === 0) return null;
          return (
            <button
              key={ef.value}
              type="button"
              onClick={() => setEventFilter(ef.value)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                eventFilter === ef.value
                  ? "bg-white dark:bg-surface-700 text-[var(--foreground)] shadow-sm"
                  : "text-muted hover:text-[var(--foreground)]"
              }`}
            >
              {ef.label}
              <span className="ml-1.5 text-xs text-muted">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Athlete Rows */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm text-muted">
            {athletes.length === 0 ? "No readiness data yet." : "No athletes in this event group."}
          </p>
          {athletes.length === 0 && (
            <p className="text-xs text-muted mt-1">
              Athletes can submit daily check-ins from their dashboard.
            </p>
          )}
        </div>
      ) : (
        <StaggeredList className="space-y-2">
          {filtered.map((athlete) => (
            <Link
              key={athlete.athleteId}
              href={`/coach/athletes/${athlete.athleteId}`}
              className="card card-interactive !p-0 block"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center shrink-0 overflow-hidden">
                  {athlete.avatarUrl ? (
                    <Image
                      src={athlete.avatarUrl}
                      alt=""
                      width={36}
                      height={36}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-muted">
                      {athlete.athleteName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                  )}
                </div>

                {/* Name + Events */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                    {athlete.athleteName}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {athlete.events.map(formatEventName).join(" · ") || "No events"}
                  </p>
                </div>

                {/* Sparkline */}
                <Sparkline history={athlete.history} />

                {/* Score */}
                <div className="text-right shrink-0 w-16">
                  {athlete.latestScore !== null ? (
                    <p
                      className={`text-lg font-bold tabular-nums ${scoreColor(
                        athlete.latestScore
                      )}`}
                    >
                      {athlete.latestScore.toFixed(1)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted">—</p>
                  )}
                </div>
              </div>

              {/* Category badges row */}
              {athlete.latestScore !== null && (
                <div className="flex items-center gap-1.5 px-4 pb-3 pt-0">
                  {(Object.entries(athlete.categories) as [string, number | null][])
                    .filter(([, v]) => v !== null)
                    .map(([key, value]) => (
                      <span
                        key={key}
                        className={`text-nano font-semibold px-1.5 py-0.5 rounded ${categoryBadgeColor(
                          value!
                        )}`}
                      >
                        {CATEGORY_LABELS[key]} {value}
                      </span>
                    ))}
                </div>
              )}
            </Link>
          ))}
        </StaggeredList>
      )}
    </>
  );
}
