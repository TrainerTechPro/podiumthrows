"use client";

import Link from "next/link";
import type { SessionDetail, ThrowResult } from "./use-session-reducer";

// ── Constants ────────────────────────────────────────────────────────

const DRILL_LABELS: Record<string, string> = {
  FULL_THROW: "Full Throw",
  STANDING: "Standing",
  HALF_TURN: "Half Turn",
  ONE_TURN: "1 Turn",
  TWO_TURN: "2 Turns",
  THREE_TURN: "3 Turns",
  FOUR_TURN: "4 Turns",
  WINDS: "Winds Only",
  DRILL: "Drill",
  OTHER: "Other",
};

const FEELING_STYLES: Record<string, { color: string; label: string }> = {
  GREAT: { color: "text-emerald-600 dark:text-emerald-400", label: "Great" },
  GOOD: { color: "text-green-600 dark:text-green-400", label: "Good" },
  OK: { color: "text-yellow-600 dark:text-yellow-400", label: "OK" },
  POOR: { color: "text-orange-600 dark:text-orange-400", label: "Poor" },
  BAD: { color: "text-red-600 dark:text-red-400", label: "Bad" },
};

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ── Props ────────────────────────────────────────────────────────────

interface CompletedSessionSummaryProps {
  session: SessionDetail;
}

// ── Component ────────────────────────────────────────────────────────

export function CompletedSessionSummary({ session }: CompletedSessionSummaryProps) {
  const feeling = FEELING_STYLES[session.selfFeeling ?? ""] ?? null;

  // Group throws by implement
  const throwsByImplement = groupThrowsByImplement(session.throwResults);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Back */}
      <Link
        href="/coach/my-program"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Program
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-title font-heading text-gray-900 dark:text-white">
            {session.focusLabel}
          </h1>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
            Complete
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {DAY_NAMES[session.dayOfWeek]} &middot; Week {session.weekNumber} &middot;
          Day {session.dayType}
        </p>
      </div>

      {/* Quick stats */}
      <div className="card bg-emerald-50/50 dark:bg-emerald-900/5">
        <div className="grid grid-cols-2 gap-3">
          {session.actualThrows != null && (
            <StatItem label="Throws" value={session.actualThrows.toString()} />
          )}
          {session.bestMark != null && (
            <StatItem label="Best Mark" value={`${session.bestMark}m`} highlight />
          )}
          {session.rpe != null && (
            <StatItem label="RPE" value={`${session.rpe}/10`} />
          )}
          {feeling && (
            <StatItem label="Feeling" value={feeling.label} className={feeling.color} />
          )}
        </div>
        {session.sessionNotes && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 italic border-t border-gray-200 dark:border-gray-700 pt-3">
            {session.sessionNotes}
          </p>
        )}
      </div>

      {/* Best marks per implement */}
      {session.bestMarks && session.bestMarks.length > 0 && (
        <div className="card">
          <h2 className="text-section font-heading text-gray-900 dark:text-white mb-3">
            Best Marks
          </h2>
          <div className="space-y-2">
            {session.bestMarks.map((mark) => (
              <div
                key={mark.id}
                className="flex items-center justify-between py-2 px-3 rounded-xl bg-primary-50 dark:bg-primary-900/10"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {mark.implement}
                  {mark.drillType && (
                    <span className="text-gray-500"> &middot; {DRILL_LABELS[mark.drillType] ?? mark.drillType}</span>
                  )}
                </span>
                <span className="text-sm font-bold text-primary-700 dark:text-primary-400 tabular-nums">
                  {mark.distance}m
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Throws grouped by implement */}
      {session.throwResults.length > 0 && (
        <div className="card">
          <h2 className="text-section font-heading text-gray-900 dark:text-white mb-3">
            All Throws ({session.throwResults.length})
          </h2>
          <div className="space-y-3">
            {Object.entries(throwsByImplement).map(([impl, throws]) => (
              <div key={impl}>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  {impl}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {throws.map((t) => (
                    <span
                      key={t.id}
                      className="text-sm tabular-nums px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      {t.distance ? `${t.distance}m` : "—"}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modification notes */}
      {session.wasModified && session.modificationNotes && (
        <div className="card border-amber-200 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-900/5">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
            Modified from prescription
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {session.modificationNotes}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function StatItem({
  label,
  value,
  highlight,
  className,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={`text-lg font-bold tabular-nums ${
          className ?? (highlight ? "text-primary-600 dark:text-primary-400" : "text-gray-900 dark:text-white")
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function groupThrowsByImplement(
  throws: ThrowResult[],
): Record<string, ThrowResult[]> {
  const grouped: Record<string, ThrowResult[]> = {};
  for (const t of throws) {
    const key = t.implement;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }
  return grouped;
}
