"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";
import { useToast } from "@/components/ui/Toast";
import { TestOverviewCard } from "./TestOverviewCard";
import { TestTrendChart } from "./TestTrendChart";
import { CoachTestCaptureSheet } from "./CoachTestCaptureSheet";
import {
  formatTestValueShort,
  recordedByDisplayName,
  type PerformanceTestSessionDTO,
  type PerformanceTestTrendPointDTO,
  type PerformanceTestTypeDTO,
} from "@/lib/performance-tests-display";

export interface PerformanceTestsSectionProps {
  athleteId: string;
  athleteName?: string;
}

interface TrendBucket {
  testType: PerformanceTestTypeDTO;
  points: PerformanceTestTrendPointDTO[];
}

/**
 * Coach athlete-detail "Performance Tests" section.
 *
 * Two views:
 *   Overview — card grid, one per test type the athlete has data for.
 *   Trend    — line chart + sortable session table for a single test type.
 *
 * Coach-side toast register: quiet success, no celebration theatrics.
 */
export function PerformanceTestsSection({ athleteId, athleteName }: PerformanceTestsSectionProps) {
  const toast = useToast();
  const [types, setTypes] = useState<PerformanceTestTypeDTO[]>([]);
  const [buckets, setBuckets] = useState<TrendBucket[]>([]);
  const [activeType, setActiveType] = useState<PerformanceTestTypeDTO | null>(null);
  const [activeSessions, setActiveSessions] = useState<PerformanceTestSessionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sortKey, setSortKey] = useState<"date" | "peak">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  /* ── Loaders ──────────────────────────────────────────────────────────── */

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const typesRes = await fetch("/api/performance-tests/types");
      const typesPayload = await typesRes.json();
      if (!typesRes.ok || !typesPayload.success) {
        throw new Error(typesPayload.error || "Failed to load test types");
      }
      const typeList = typesPayload.data as PerformanceTestTypeDTO[];
      setTypes(typeList);

      const trendResults = await Promise.all(
        typeList.map(async (t) => {
          const res = await fetch(
            `/api/performance-tests/athletes/${athleteId}/trends/${t.key}?limit=8`
          );
          const payload = await res.json();
          if (!res.ok || !payload.success) return null;
          const points = (payload.data?.points ?? []) as PerformanceTestTrendPointDTO[];
          return points.length ? { testType: t, points } : null;
        })
      );

      setBuckets(trendResults.filter((b): b is TrendBucket => b !== null));
    } catch (err) {
      logger.error("performance-tests: overview load failed", {
        context: "performance-tests/section",
        error: err,
      });
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  const loadTrend = useCallback(
    async (testType: PerformanceTestTypeDTO) => {
      try {
        const res = await fetch(
          `/api/performance-tests/athletes/${athleteId}/sessions?testTypeKey=${testType.key}&limit=100`
        );
        const payload = await res.json();
        if (!res.ok || !payload.success) {
          throw new Error(payload.error || "Failed to load sessions");
        }
        const items = (payload.data?.items ?? []) as PerformanceTestSessionDTO[];
        setActiveSessions(items);
      } catch (err) {
        logger.error("performance-tests: trend sessions load failed", {
          context: "performance-tests/section",
          error: err,
        });
        setActiveSessions([]);
      }
    },
    [athleteId]
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (activeType) void loadTrend(activeType);
  }, [activeType, loadTrend]);

  /* ── Inline edit on trend table ───────────────────────────────────────── */

  async function handleInlineEdit(sessionId: string, attemptId: string, raw: string) {
    const next = parseFloat(raw);
    if (!Number.isFinite(next) || next < 0) return;
    try {
      const res = await fetch(`/api/performance-tests/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ value: next }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        toast.error(payload.error || "Couldn't update attempt");
        return;
      }
      // Refresh both views so chart and aggregates stay in sync.
      if (activeType) await loadTrend(activeType);
      await loadOverview();
    } catch (err) {
      logger.error("performance-tests: inline edit failed", {
        context: "performance-tests/section",
        error: err,
      });
      toast.error("Network error", "Check your connection and try again.");
    } finally {
      setEditingId(null);
      // Mark sessionId as "touched" — used by tests / future logging.
      void sessionId;
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (!confirm("Delete this session and all its attempts?")) return;
    try {
      const res = await fetch(`/api/performance-tests/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { ...csrfHeaders() },
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        toast.error(payload.error || "Couldn't delete session");
        return;
      }
      toast.success("Session deleted");
      if (activeType) await loadTrend(activeType);
      await loadOverview();
    } catch (err) {
      logger.error("performance-tests: delete session failed", {
        context: "performance-tests/section",
        error: err,
      });
      toast.error("Network error", "Check your connection and try again.");
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-[var(--foreground)]">
          Performance Tests
        </h2>
        <div className="text-sm text-muted">Loading…</div>
      </section>
    );
  }

  if (activeType) {
    const trendPoints = buckets.find((b) => b.testType.id === activeType.id)?.points ?? [];

    const sorted = activeSessions.slice().sort((a, b) => {
      const factor = sortDir === "asc" ? 1 : -1;
      if (sortKey === "peak") {
        const av = a.peakValue ?? Number.POSITIVE_INFINITY;
        const bv = b.peakValue ?? Number.POSITIVE_INFINITY;
        return (av - bv) * factor;
      }
      return (new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()) * factor;
    });

    return (
      <section className="space-y-5">
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setActiveType(null)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-[var(--foreground)] transition-colors"
          >
            <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
            Performance Tests
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="btn-primary inline-flex items-center gap-1.5 text-sm py-2"
          >
            <Plus size={14} strokeWidth={2} aria-hidden="true" />
            Log session
          </button>
        </header>

        <div>
          <h2 className="font-heading text-xl font-semibold text-[var(--foreground)]">
            {activeType.name}
          </h2>
          <p className="text-xs text-muted mt-0.5">
            {activeType.lowerIsBetter ? "Lower is better" : "Higher is better"} · {activeType.unit}
          </p>
        </div>

        <TestTrendChart testType={activeType} points={trendPoints} />

        {sorted.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <th
                    className="cursor-pointer pb-2 pr-4"
                    onClick={() => {
                      setSortKey("date");
                      setSortDir((d) => (sortKey === "date" && d === "desc" ? "asc" : "desc"));
                    }}
                  >
                    Date {sortKey === "date" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </th>
                  <th
                    className="cursor-pointer pb-2 pr-4"
                    onClick={() => {
                      setSortKey("peak");
                      setSortDir((d) => (sortKey === "peak" && d === "desc" ? "asc" : "desc"));
                    }}
                  >
                    Peak {sortKey === "peak" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </th>
                  <th className="pb-2 pr-4">Avg</th>
                  <th className="pb-2 pr-4">Attempts</th>
                  <th className="pb-2 pr-4">Recorded by</th>
                  <th className="pb-2 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => {
                  const peakAttempt = s.attempts?.find((a) => a.isValid && a.value === s.peakValue);
                  const isEditingPeak = peakAttempt != null && editingId === peakAttempt.id;
                  return (
                    <tr
                      key={s.id}
                      className="border-t border-[var(--card-border)] hover:bg-surface-50 dark:hover:bg-surface-800/50"
                    >
                      <td className="py-2.5 pr-4 text-[var(--foreground)]">
                        {new Date(s.performedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2.5 pr-4 font-mono tabular-nums text-[var(--foreground)]">
                        {isEditingPeak ? (
                          <input
                            autoFocus
                            type="number"
                            inputMode="decimal"
                            step={activeType.unit === "sec" ? "0.01" : "0.1"}
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onBlur={() =>
                              peakAttempt && handleInlineEdit(s.id, peakAttempt.id, editDraft)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && peakAttempt) {
                                e.currentTarget.blur();
                              }
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="input w-24 font-mono tabular-nums"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (peakAttempt) {
                                setEditingId(peakAttempt.id);
                                setEditDraft(peakAttempt.value.toString());
                              }
                            }}
                            className="hover:underline"
                            disabled={!peakAttempt}
                          >
                            {s.peakValue != null
                              ? formatTestValueShort(s.peakValue, activeType.unit)
                              : "—"}
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 font-mono tabular-nums text-muted">
                        {s.avgValue != null
                          ? formatTestValueShort(s.avgValue, activeType.unit)
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-4 font-mono tabular-nums text-muted">
                        {s.attemptCount}
                      </td>
                      <td className="py-2.5 pr-4 text-muted text-xs">
                        {recordedByDisplayName(s.recordedBy, s.recordedByRole)}
                      </td>
                      <td className="py-2.5 pr-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(s.id)}
                          aria-label="Delete session"
                          className="p-1.5 rounded-md text-muted hover:text-danger-500 transition-colors"
                        >
                          <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted py-6 text-center">No sessions on file.</p>
        )}

        <CoachTestCaptureSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          athleteId={athleteId}
          athleteName={athleteName}
          initialTestTypeKey={activeType.key}
          onComplete={() => {
            void loadTrend(activeType);
            void loadOverview();
          }}
        />
      </section>
    );
  }

  /* Overview view */
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-[var(--foreground)]">
          Performance Tests
        </h2>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="btn-secondary inline-flex items-center gap-1.5 text-sm py-2"
        >
          <Plus size={14} strokeWidth={2} aria-hidden="true" />
          Log session
        </button>
      </header>

      {buckets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--card-border)] px-5 py-10 text-center">
          <p className="text-sm text-muted">No performance tests on file.</p>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="btn-primary mt-3 text-sm py-2"
          >
            Log first session
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {buckets.map((b) => (
            <TestOverviewCard
              key={b.testType.id}
              testType={b.testType}
              points={b.points}
              onViewAll={(t) => setActiveType(t)}
            />
          ))}
        </div>
      )}

      <CoachTestCaptureSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        athleteId={athleteId}
        athleteName={athleteName}
        onComplete={() => {
          void loadOverview();
        }}
      />

      {/* Suppress unused-types warning — types is loaded ahead of buckets */}
      <span className="hidden">{types.length}</span>
    </section>
  );
}
