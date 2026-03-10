"use client";

import { useState } from "react";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface DrillLog {
  id: string;
  drillType: string;
  implementWeight: number | null;
  throwCount: number;
  bestMark: number | null;
  notes: string | null;
}

interface AthleteLog {
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
  athlete: { firstName: string; lastName: string; id: string };
  createdAt: string;
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
  GREAT: "Great",
  GOOD: "Good",
  OK: "OK",
  POOR: "Poor",
  BAD: "Bad",
};

const EVENTS = [
  { value: "", label: "All Events" },
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
];

function formatSessionDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function ScaleDots({ value, max = 5 }: { value: number | null; max?: number }) {
  if (value === null) return <span className="text-xs text-muted">--</span>;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < value ? "bg-primary-500" : "bg-surface-300 dark:bg-surface-700"
          }`}
        />
      ))}
    </div>
  );
}

/* ─── Detail View ──────────────────────────────────────────────────────────── */

function LogDetail({ session }: { session: AthleteLog }) {
  const totalThrows = session.drillLogs.reduce((sum, d) => sum + d.throwCount, 0);
  const bestDists = session.drillLogs.map((d) => d.bestMark).filter((n): n is number => n !== null && n > 0);
  const sessionBest = bestDists.length > 0 ? Math.max(...bestDists) : null;

  return (
    <div className="px-4 pb-4 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-200">
      {/* Stats */}
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

      {/* Readiness */}
      {(session.sleepQuality || session.sorenessLevel || session.energyLevel) && (
        <div className="flex gap-6 text-xs">
          <div><span className="text-muted">Sleep</span><div className="mt-0.5"><ScaleDots value={session.sleepQuality} /></div></div>
          <div><span className="text-muted">Soreness</span><div className="mt-0.5"><ScaleDots value={session.sorenessLevel} /></div></div>
          <div><span className="text-muted">Energy</span><div className="mt-0.5"><ScaleDots value={session.energyLevel} /></div></div>
        </div>
      )}

      {/* Technique + Mental */}
      {(session.techniqueRating || session.mentalFocus) && (
        <div className="flex gap-6 text-xs">
          {session.techniqueRating && (
            <div><span className="text-muted">Technique</span><div className="mt-0.5"><ScaleDots value={session.techniqueRating} /></div></div>
          )}
          {session.mentalFocus && (
            <div><span className="text-muted">Mental Focus</span><div className="mt-0.5"><ScaleDots value={session.mentalFocus} /></div></div>
          )}
        </div>
      )}

      {/* Drill table */}
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
              {session.drillLogs.map((d) => (
                <tr key={d.id} className="border-b border-[var(--card-border)] last:border-0">
                  <td className="py-1.5 text-[var(--foreground)] font-medium">{d.drillType}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{d.throwCount}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{d.implementWeight ? `${d.implementWeight}kg` : "--"}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{d.bestMark ? `${d.bestMark.toFixed(2)}m` : "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Text feedback */}
      {(session.bestPart || session.improvementArea || session.notes) && (
        <div className="space-y-1 text-xs">
          {session.bestPart && <p><span className="text-muted">Went well:</span> <span className="text-[var(--foreground)]">{session.bestPart}</span></p>}
          {session.improvementArea && <p><span className="text-muted">Needs work:</span> <span className="text-[var(--foreground)]">{session.improvementArea}</span></p>}
          {session.notes && <p><span className="text-muted">Notes:</span> <span className="text-[var(--foreground)]">{session.notes}</span></p>}
        </div>
      )}
    </div>
  );
}

/* ─── Main List ────────────────────────────────────────────────────────────── */

export function AthleteLogsList({ sessions }: { sessions: AthleteLog[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterEvent, setFilterEvent] = useState("");
  const [filterAthlete, setFilterAthlete] = useState("");

  // Unique athletes for filter
  const athletes = [...new Map(sessions.map((s) => [s.athlete.id, s.athlete])).values()]
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  const filtered = sessions.filter((s) => {
    if (filterEvent && s.event !== filterEvent) return false;
    if (filterAthlete && s.athlete.id !== filterAthlete) return false;
    return true;
  });

  if (sessions.length === 0) {
    return (
      <div className="card py-12 text-center">
        <p className="text-sm text-muted">No athlete session logs yet.</p>
        <p className="text-xs text-muted mt-1">When athletes log their own sessions, they&apos;ll appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Athlete filter */}
        <select
          value={filterAthlete}
          onChange={(e) => setFilterAthlete(e.target.value)}
          className="input text-sm h-8 w-auto"
        >
          <option value="">All Athletes</option>
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
          ))}
        </select>

        {/* Event filter */}
        <div className="flex items-center gap-1">
          {EVENTS.map((ev) => (
            <button
              key={ev.value}
              onClick={() => setFilterEvent(ev.value)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                filterEvent === ev.value
                  ? "bg-primary-500/15 text-primary-600 dark:text-primary-400"
                  : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
              }`}
            >
              {ev.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-muted ml-auto">
          {filtered.length} session{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      <div className="card divide-y divide-[var(--card-border)] overflow-hidden">
        {filtered.map((session) => {
          const isExpanded = expandedId === session.id;
          const totalThrows = session.drillLogs.reduce((sum, d) => sum + d.throwCount, 0);
          const drillCount = session.drillLogs.length;

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
                  {/* Date blob */}
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

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${EVENT_DOT[session.event] ?? "bg-surface-400"}`} />
                      <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                        {session.athlete.firstName} {session.athlete.lastName}
                      </p>
                      <span className="text-xs text-muted">
                        {EVENT_LABELS[session.event] ?? session.event}
                      </span>
                    </div>
                    <p className="text-xs text-muted truncate mt-0.5">
                      {formatSessionDate(session.date)}
                      {session.focus && <> &middot; {session.focus}</>}
                      {drillCount > 0 && <> &middot; {drillCount} drill{drillCount !== 1 ? "s" : ""}</>}
                      {totalThrows > 0 && <> &middot; {totalThrows} throws</>}
                      {session.sessionRpe && <> &middot; RPE {session.sessionRpe}</>}
                    </p>
                  </div>

                  {/* Chevron */}
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

              {isExpanded && <LogDetail session={session} />}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-muted">
            No sessions match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
