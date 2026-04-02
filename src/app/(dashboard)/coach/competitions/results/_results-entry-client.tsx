"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Trophy,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { MeetSummary, MeetEntry, AthletePickerItem } from "@/lib/data/coach";
import { COMPETITION_WEIGHTS } from "@/lib/throws";

/* ─── Constants ─────────────────────────────────────────────────────────── */

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const PRIORITY_STYLES: Record<string, string> = {
  A: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  B: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  C: "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400",
};

/* ─── Types ─────────────────────────────────────────────────────────────── */

type ResultRow = MeetEntry & {
  dirty: boolean;
  implementWeight: string;
};

/* ─── Component ─────────────────────────────────────────────────────────── */

export function ResultsEntryClient({
  meets,
  athletes: _athletes,
}: {
  meets: MeetSummary[];
  athletes: AthletePickerItem[];
}) {
  const searchParams = useSearchParams();
  const { success, error: showError, celebration } = useToast();

  // Pre-select meet from URL params
  const urlMeet = searchParams.get("meet");
  const urlDate = searchParams.get("date");

  const [selectedMeetKey, setSelectedMeetKey] = useState<string>(() => {
    if (urlMeet && urlDate) return `${urlMeet}::${urlDate}`;
    return meets.length > 0 ? `${meets[0].name}::${meets[0].date}` : "";
  });

  const selectedMeet = meets.find(
    (m) => `${m.name}::${m.date}` === selectedMeetKey,
  );

  // Build editable rows from the selected meet
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [saving, setSaving] = useState(false);
  const distanceRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Initialize rows when meet selection changes
  useEffect(() => {
    if (!selectedMeet) {
      setRows([]);
      return;
    }
    setRows(
      selectedMeet.entries.map((e) => {
        const gender = e.gender === "MALE" ? "male" : "female";
        const weight = COMPETITION_WEIGHTS[e.event]?.[gender as "male" | "female"];
        return {
          ...e,
          dirty: false,
          implementWeight: weight ? `${weight}kg` : "—",
        };
      }),
    );
  }, [selectedMeetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateRow = useCallback((id: string, field: keyof ResultRow, value: unknown) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, [field]: value, dirty: true } : r,
      ),
    );
  }, []);

  // Tab key navigation: move to next distance field
  const handleDistanceKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, currentId: string) => {
      if (e.key === "Tab" && !e.shiftKey) {
        const ids = rows.map((r) => r.id);
        const idx = ids.indexOf(currentId);
        const nextId = ids[idx + 1];
        if (nextId) {
          e.preventDefault();
          distanceRefs.current.get(nextId)?.focus();
        }
      }
      if (e.key === "Tab" && e.shiftKey) {
        const ids = rows.map((r) => r.id);
        const idx = ids.indexOf(currentId);
        const prevId = ids[idx - 1];
        if (prevId) {
          e.preventDefault();
          distanceRefs.current.get(prevId)?.focus();
        }
      }
    },
    [rows],
  );

  // Save all dirty rows
  async function handleSaveAll() {
    const dirtyRows = rows.filter((r) => r.dirty);
    if (dirtyRows.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/coach/competitions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          results: dirtyRows.map((r) => ({
            id: r.id,
            result: r.result,
            notes: r.notes,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      // Mark all rows as clean
      setRows((prev) => prev.map((r) => ({ ...r, dirty: false })));

      // Fire PR celebrations
      if (data.prs?.length > 0) {
        for (const pr of data.prs) {
          const eventLabel = EVENT_LABELS[pr.event] || pr.event;
          celebration(`New Competition PR!`, {
            highlight: `${pr.distance.toFixed(2)}m`,
            description: `${pr.athleteName} — ${eventLabel}${
              pr.previousBest ? ` (prev: ${pr.previousBest.toFixed(2)}m)` : ""
            }`,
          });
        }
      }

      success(
        "Results Saved",
        `${dirtyRows.length} result${dirtyRows.length > 1 ? "s" : ""} updated${
          data.prs?.length > 0 ? ` · ${data.prs.length} PR${data.prs.length > 1 ? "s" : ""} detected!` : ""
        }`,
      );
    } catch (err) {
      showError("Save Failed", err instanceof Error ? err.message : "Failed to save results");
    } finally {
      setSaving(false);
    }
  }

  const dirtyCount = rows.filter((r) => r.dirty).length;

  // Group rows by event for better organization
  const rowsByEvent = new Map<string, ResultRow[]>();
  for (const r of rows) {
    if (!rowsByEvent.has(r.event)) rowsByEvent.set(r.event, []);
    rowsByEvent.get(r.event)!.push(r);
  }

  return (
    <div className="space-y-6">
      <ScrollProgressBar />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/coach/competitions"
          className="p-2 rounded-lg text-muted hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          aria-label="Back to competitions"
        >
          <ArrowLeft size={20} strokeWidth={1.75} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-2xl font-bold text-[var(--foreground)]">
            Enter Results
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Record competition distances for your athletes
          </p>
        </div>
      </div>

      {/* Meet Selector */}
      {meets.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="text-sm font-semibold text-muted uppercase tracking-wider shrink-0">
            Meet
          </label>
          <select
            value={selectedMeetKey}
            onChange={(e) => setSelectedMeetKey(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            {meets.map((m) => (
              <option key={`${m.name}::${m.date}`} value={`${m.name}::${m.date}`}>
                {m.name} — {new Date(m.date + "T12:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </option>
            ))}
          </select>

          {selectedMeet && (
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${PRIORITY_STYLES[selectedMeet.priority] || ""}`}>
              {selectedMeet.priority} Meet
            </span>
          )}
        </div>
      )}

      {/* Empty */}
      {meets.length === 0 && (
        <EmptyState
          icon={<Trophy size={40} strokeWidth={1.5} />}
          title="No meets scheduled"
          description="Create a meet first, then come back here to enter results."
          action={
            <Link href="/coach/competitions">
              <Button>Go to Competitions</Button>
            </Link>
          }
        />
      )}

      {/* Results Table */}
      {selectedMeet && rows.length > 0 && (
        <>
          {Array.from(rowsByEvent.entries()).map(([event, eventRows]) => (
            <section key={event}>
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                {EVENT_LABELS[event] || event}
                <Badge variant="neutral">
                  {eventRows.length} athlete{eventRows.length !== 1 ? "s" : ""}
                </Badge>
              </h2>

              <div className="overflow-x-auto custom-scrollbar rounded-xl border border-[var(--card-border)]">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-[var(--card-border)] bg-surface-50 dark:bg-surface-900/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                        Athlete
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                        Implement
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                        Distance (m)
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b border-[var(--card-border)] last:border-b-0 transition-colors ${
                          row.dirty
                            ? "bg-primary-500/5"
                            : "hover:bg-surface-50 dark:hover:bg-surface-800/50"
                        }`}
                      >
                        {/* Athlete Name */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-[var(--foreground)]">
                            {row.athleteName}
                          </span>
                        </td>

                        {/* Implement Weight */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono tabular-nums text-muted">
                            {row.implementWeight}
                          </span>
                        </td>

                        {/* Distance Input */}
                        <td className="px-4 py-3">
                          <input
                            ref={(el) => {
                              if (el) distanceRefs.current.set(row.id, el);
                              else distanceRefs.current.delete(row.id);
                            }}
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            placeholder="—"
                            value={row.result ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateRow(
                                row.id,
                                "result",
                                val === "" ? null : parseFloat(val),
                              );
                            }}
                            onKeyDown={(e) => handleDistanceKeyDown(e, row.id)}
                            className="w-28 px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] font-mono tabular-nums text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </td>

                        {/* Notes */}
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            placeholder="Optional notes..."
                            value={row.notes ?? ""}
                            onChange={(e) =>
                              updateRow(row.id, "notes", e.target.value || null)
                            }
                            className="w-full max-w-xs px-3 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {/* Save Bar */}
          <div className="sticky bottom-4 flex items-center justify-between gap-4 p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-lg">
            <div className="flex items-center gap-2 text-sm text-muted">
              {dirtyCount > 0 ? (
                <>
                  <AlertCircle size={16} strokeWidth={1.75} className="text-amber-500" aria-hidden="true" />
                  <span className="font-mono tabular-nums">{dirtyCount}</span> unsaved change{dirtyCount !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  <Sparkles size={16} strokeWidth={1.75} className="text-green-500" aria-hidden="true" />
                  All results saved
                </>
              )}
            </div>
            <Button onClick={handleSaveAll} disabled={dirtyCount === 0 || saving}>
              <Save size={16} strokeWidth={1.75} aria-hidden="true" />
              {saving ? "Saving..." : `Save All${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
