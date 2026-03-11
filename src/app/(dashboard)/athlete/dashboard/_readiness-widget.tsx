"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface ReadinessData {
  overallScore: number;
  injuryStatus: string;
  date: string;
  sleepQuality: number;
  soreness: number;
  energyMood: number;
  stressLevel: number;
  sleepHours: number;
  hydration: string;
}

/* ─── Ring ───────────────────────────────────────────────────────────────── */

function ReadinessRing({ score }: { score: number }) {
  const pct = score / 10;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color =
    score >= 8 ? "#10b981" : score >= 5 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle
          cx="48" cy="48" r={r}
          fill="none" stroke="currentColor" strokeWidth="8"
          className="text-surface-200 dark:text-surface-700"
        />
        <circle
          cx="48" cy="48" r={r}
          fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums font-heading" style={{ color }}>
          {score.toFixed(1)}
        </span>
        <span className="text-[10px] text-muted uppercase tracking-wide">Readiness</span>
      </div>
    </div>
  );
}

/* ─── Breakdown Bar ─────────────────────────────────────────────────────── */

function BreakdownBar({
  label,
  value,
  max = 10,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = (value / max) * 100;
  const barColor =
    pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 text-muted shrink-0 text-right">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="w-6 tabular-nums text-muted shrink-0">{value}</span>
    </div>
  );
}

/* ─── Main Widget ───────────────────────────────────────────────────────── */

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export function ReadinessWidget({ data }: { data: ReadinessData | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!data) {
    return (
      <div className="card px-5 py-4 sm:col-span-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted">No check-in yet</p>
          <Link
            href="/athlete/wellness"
            className="text-xs text-primary-500 hover:underline mt-0.5 inline-block"
          >
            Submit today&apos;s check-in →
          </Link>
        </div>
      </div>
    );
  }

  const scoreLabel =
    data.overallScore >= 8
      ? "Feeling great"
      : data.overallScore >= 5
      ? "Moderate readiness"
      : "Low readiness";

  return (
    <div className="card px-5 py-4 sm:col-span-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
        aria-expanded={expanded}
        aria-label="Toggle readiness breakdown"
      >
        <div className="flex items-center gap-4">
          <ReadinessRing score={data.overallScore} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {scoreLabel}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {formatRelativeDate(data.date)}
                  {data.sleepHours > 0 && (
                    <> &middot; {data.sleepHours}h sleep</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {data.injuryStatus === "ACTIVE" && (
                  <Badge variant="danger">Injured</Badge>
                )}
                {data.injuryStatus === "MONITORING" && (
                  <Badge variant="warning">Watch</Badge>
                )}
                <svg
                  width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  className={`text-muted shrink-0 transition-transform duration-200 ${
                    expanded ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </button>

      {/* Expandable breakdown */}
      <div
        className="grid transition-all duration-200 ease-out"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
        }}
      >
        <div className="overflow-hidden">
          <div className="pt-3 mt-3 border-t border-[var(--card-border)] space-y-1.5">
            <BreakdownBar label="Sleep" value={data.sleepQuality} />
            <BreakdownBar label="Soreness" value={data.soreness} />
            <BreakdownBar label="Energy" value={data.energyMood} />
            <BreakdownBar label="Stress" value={data.stressLevel} />
          </div>
        </div>
      </div>
    </div>
  );
}
