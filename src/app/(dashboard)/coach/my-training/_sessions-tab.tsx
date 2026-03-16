"use client";

import { useState } from "react";
import Link from "next/link";
import { csrfHeaders } from "@/lib/csrf-client";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface DrillLog {
  id: string;
  drillType: string;
  implementWeight: number | null;
  throwCount: number;
  bestMark: number | null;
  notes: string | null;
}

interface CoachSession {
  id: string;
  event: string;
  date: string;
  focus: string | null;
  notes: string | null;
  sleepQuality: number | null;
  sorenessLevel: number | null;
  energyLevel: number | null;
  sessionRpe: number | null;
  sessionFeeling: string | null;
  techniqueRating: number | null;
  mentalFocus: number | null;
  bestPart: string | null;
  improvementArea: string | null;
  drillLogs: DrillLog[];
  createdAt: string;
}

interface CoachPR {
  event: string;
  implement: string;
  distance: number;
}

interface BondarchukWarningItem {
  type: string;
  message: string;
  severity: string;
}

const EVENT_DOT: Record<string, string> = {
  SHOT_PUT: "bg-blue-500",
  DISCUS: "bg-purple-500",
  HAMMER: "bg-red-500",
  JAVELIN: "bg-green-500",
};

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const FEELING_LABELS: Record<string, string> = {
  GREAT: "Great", GOOD: "Good", OK: "OK", POOR: "Poor", BAD: "Bad",
};

function formatSessionDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function ScaleDots({ value, max = 5 }: { value: number | null; max?: number }) {
  if (value === null) return <span className="text-xs text-muted">--</span>;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < value ? "bg-primary-500" : "bg-surface-300 dark:bg-surface-700"}`} />
      ))}
    </div>
  );
}

/* ─── Detail View ──────────────────────────────────────────────────────────── */

function SessionDetail({
  session,
  prs,
  warnings,
  onDelete,
}: {
  session: CoachSession;
  prs: CoachPR[];
  warnings: BondarchukWarningItem[];
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const totalThrows = session.drillLogs.reduce((sum, d) => sum + d.throwCount, 0);
  const bestDists = session.drillLogs.map((d) => d.bestMark).filter((n): n is number => n !== null && n > 0);
  const sessionBest = bestDists.length > 0 ? Math.max(...bestDists) : null;

  // Build a set for quick PR lookup: "drillType-implementWeight"
  const prSet = new Set(
    prs.map((pr) => `${pr.event}-${pr.implement}`)
  );

  async function handleDelete() {
    if (!confirm("Delete this session?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/coach/log-session/${session.id}`, { method: "DELETE", headers: csrfHeaders() });
      if (res.ok) onDelete();
    } catch {
      alert("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="px-4 pb-4 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex flex-wrap gap-4 text-xs">
        <div>
          <span className="text-muted uppercase tracking-wider">Throws</span>
          <p className="font-semibold text-[var(--foreground)] tabular-nums">{totalThrows}</p>
        </div>
        {sessionBest && (
          <div>
            <span className="text-muted uppercase tracking-wider">Best</span>
            <p className="font-semibold text-[var(--foreground)] tabular-nums">{sessionBest.toFixed(2)}m</p>
          </div>
        )}
        {session.sessionRpe && (
          <div>
            <span className="text-muted uppercase tracking-wider">RPE</span>
            <p className="font-semibold text-[var(--foreground)] tabular-nums">{session.sessionRpe}/10</p>
          </div>
        )}
        {session.sessionFeeling && (
          <div>
            <span className="text-muted uppercase tracking-wider">Feeling</span>
            <p className="font-semibold text-[var(--foreground)]">{FEELING_LABELS[session.sessionFeeling] ?? session.sessionFeeling}</p>
          </div>
        )}
        {session.focus && (
          <div>
            <span className="text-muted uppercase tracking-wider">Focus</span>
            <p className="font-semibold text-[var(--foreground)]">{session.focus}</p>
          </div>
        )}
      </div>

      {(session.sleepQuality || session.sorenessLevel || session.energyLevel) && (
        <div className="flex gap-6 text-xs">
          <div><span className="text-muted">Sleep</span><div className="mt-0.5"><ScaleDots value={session.sleepQuality} /></div></div>
          <div><span className="text-muted">Soreness</span><div className="mt-0.5"><ScaleDots value={session.sorenessLevel} /></div></div>
          <div><span className="text-muted">Energy</span><div className="mt-0.5"><ScaleDots value={session.energyLevel} /></div></div>
        </div>
      )}

      {(session.techniqueRating || session.mentalFocus) && (
        <div className="flex gap-6 text-xs">
          {session.techniqueRating && <div><span className="text-muted">Technique</span><div className="mt-0.5"><ScaleDots value={session.techniqueRating} /></div></div>}
          {session.mentalFocus && <div><span className="text-muted">Mental Focus</span><div className="mt-0.5"><ScaleDots value={session.mentalFocus} /></div></div>}
        </div>
      )}

      {/* Bondarchuk warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0 mt-0.5">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-xs text-amber-800 dark:text-amber-300">{w.message}</p>
            </div>
          ))}
        </div>
      )}

      {session.drillLogs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--card-border)]">
                <th className="text-left py-1.5 text-muted font-semibold">Drill</th>
                <th className="text-right py-1.5 text-muted font-semibold">Reps</th>
                <th className="text-right py-1.5 text-muted font-semibold">Weight</th>
                <th className="text-right py-1.5 text-muted font-semibold">Best</th>
              </tr>
            </thead>
            <tbody>
              {session.drillLogs.map((d) => {
                const isPR = d.implementWeight && d.bestMark && d.bestMark > 0 &&
                  prSet.has(`${session.event}-${d.implementWeight}kg`);
                return (
                  <tr key={d.id} className="border-b border-[var(--card-border)] last:border-0">
                    <td className="py-1.5 text-[var(--foreground)] font-medium">
                      {d.drillType}
                      {isPR && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                          PR
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted">{d.throwCount}</td>
                    <td className="py-1.5 text-right tabular-nums text-muted">{d.implementWeight ? `${d.implementWeight}kg` : "--"}</td>
                    <td className="py-1.5 text-right tabular-nums text-muted">{d.bestMark ? `${d.bestMark.toFixed(2)}m` : "--"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(session.bestPart || session.improvementArea || session.notes) && (
        <div className="space-y-1 text-xs">
          {session.bestPart && <p><span className="text-muted">Went well:</span> <span className="text-[var(--foreground)]">{session.bestPart}</span></p>}
          {session.improvementArea && <p><span className="text-muted">Needs work:</span> <span className="text-[var(--foreground)]">{session.improvementArea}</span></p>}
          {session.notes && <p><span className="text-muted">Notes:</span> <span className="text-[var(--foreground)]">{session.notes}</span></p>}
        </div>
      )}

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-xs text-muted hover:text-danger-500 transition-colors"
      >
        {deleting ? "Deleting..." : "Delete session"}
      </button>
    </div>
  );
}

/* ─── Sessions Tab ─────────────────────────────────────────────────────────── */

export function SessionsTab({
  sessions: initial,
  prs,
  competitiveMode,
}: {
  sessions: CoachSession[];
  prs: CoachPR[];
  competitiveMode: boolean;
}) {
  const [sessions, setSessions] = useState(initial);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build warnings for sessions in competitive mode
  function getSessionWarnings(session: CoachSession): BondarchukWarningItem[] {
    if (!competitiveMode) return [];
    const weights = session.drillLogs
      .map((d) => d.implementWeight)
      .filter((w): w is number => w != null);
    if (weights.length < 2) return [];

    const warnings: BondarchukWarningItem[] = [];
    for (let i = 1; i < weights.length; i++) {
      if (weights[i] > weights[i - 1]) {
        warnings.push({
          type: "ascending_weight",
          message: `Ascending weight sequence: ${weights[i - 1]}kg -> ${weights[i]}kg. Descending order is required for natural athletes.`,
          severity: "error",
        });
        break;
      }
    }
    return warnings;
  }

  if (sessions.length === 0) {
    return (
      <div className="card py-12 text-center space-y-3">
        <p className="text-sm text-muted">No training sessions logged yet.</p>
        <Link href="/coach/log-session" className="btn-primary inline-block">
          + Log Your First Session
        </Link>
      </div>
    );
  }

  return (
    <div className="card divide-y divide-[var(--card-border)] overflow-hidden">
      {sessions.map((session) => {
        const isExpanded = expandedId === session.id;
        const totalThrows = session.drillLogs.reduce((sum, d) => sum + d.throwCount, 0);
        const drillCount = session.drillLogs.length;
        const sessionWarnings = getSessionWarnings(session);

        // Check if any drill in this session has a matching PR
        const hasPR = session.drillLogs.some(
          (d) =>
            d.implementWeight &&
            d.bestMark &&
            d.bestMark > 0 &&
            prs.some(
              (pr) => pr.event === session.event && pr.implement === `${d.implementWeight}kg` && pr.distance === d.bestMark
            )
        );

        return (
          <div key={session.id}>
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : session.id)}
              className={`w-full text-left transition-colors ${
                isExpanded
                  ? "bg-surface-50 dark:bg-surface-900/40"
                  : "hover:bg-surface-50/60 dark:hover:bg-surface-900/20"
              }`}
            >
              <div className="flex items-center gap-4 px-4 py-3.5">
                <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 text-center bg-surface-100 dark:bg-surface-800 text-muted">
                  <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
                    {(() => {
                      const [, m] = session.date.split("-").map(Number);
                      return ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m];
                    })()}
                  </span>
                  <span className="text-lg font-bold leading-tight tabular-nums">
                    {parseInt(session.date.split("-")[2], 10)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${EVENT_DOT[session.event] ?? "bg-surface-400"}`} />
                    <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                      {EVENT_LABELS[session.event] ?? session.event}
                      {session.focus && <span className="text-muted font-normal"> — {session.focus}</span>}
                    </p>
                    {hasPR && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                        PR
                      </span>
                    )}
                    {sessionWarnings.length > 0 && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-muted truncate mt-0.5">
                    {formatSessionDate(session.date)}
                    {drillCount > 0 && <> &middot; {drillCount} drill{drillCount !== 1 ? "s" : ""}</>}
                    {totalThrows > 0 && <> &middot; {totalThrows} throws</>}
                    {session.sessionRpe && <> &middot; RPE {session.sessionRpe}</>}
                  </p>
                </div>

                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-muted shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>

            {isExpanded && (
              <SessionDetail
                session={session}
                prs={prs}
                warnings={sessionWarnings}
                onDelete={() => setSessions((prev) => prev.filter((s) => s.id !== session.id))}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
