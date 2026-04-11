"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { HistoryDay } from "@/lib/throws/history-types";
import { HistoryDrillRow } from "./_history-drill-row";

// Inline event colors mirror EVENT_META used elsewhere in the codebase.
// Hex literals are intentional here per the plan; no shared constant exists yet
// for the event badge palette in this exact form.
const EVENT_COLORS: Record<string, string> = {
  SHOT_PUT: "#E85D26",
  DISCUS: "#2563EB",
  HAMMER: "#7C3AED",
  JAVELIN: "#059669",
};

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "SP",
  DISCUS: "DT",
  HAMMER: "HT",
  JAVELIN: "JT",
};

interface Props {
  day: HistoryDay;
}

export function HistoryDayCard({ day }: Props) {
  const [expanded, setExpanded] = useState(false);
  const best = day.bestMarkOverall != null ? `${day.bestMarkOverall.toFixed(2)}m` : null;

  return (
    <div className={`card ${expanded ? "border-primary-500/30" : ""}`}>
      <button
        type="button"
        className="w-full text-left p-4 flex items-start gap-3"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        aria-label={`${day.weekdayShort} ${day.dateLabel} — ${day.totalThrows} throws`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-mono text-muted uppercase tracking-wider">
              {day.weekdayShort}
            </span>
          </div>
          <div className="text-base font-heading font-semibold text-[var(--foreground)] mt-0.5">
            {day.dateLabel}
          </div>

          <div className="flex gap-1 mt-2">
            {day.events.map((ev) => (
              <span
                key={ev}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white tracking-wide"
                style={{ backgroundColor: EVENT_COLORS[ev] || "#666" }}
              >
                {EVENT_LABELS[ev] || ev}
              </span>
            ))}
          </div>

          <div className="flex items-baseline gap-3 mt-2">
            <span className="text-sm text-surface-700 dark:text-surface-300">
              <span className="font-mono font-semibold text-[var(--foreground)] tabular-nums">
                {day.totalThrows}
              </span>{" "}
              throws
            </span>
            {best && (
              <span className="text-sm text-surface-700 dark:text-surface-300">
                Best{" "}
                <span className="font-mono font-semibold text-[var(--foreground)] tabular-nums">
                  {best}
                </span>
              </span>
            )}
            {day.hasPR && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded bg-primary-500/15 text-primary-500 inline-flex items-center gap-1"
                aria-label="Personal best"
              >
                ★ PR
              </span>
            )}
          </div>
        </div>

        <ChevronRight
          size={18}
          strokeWidth={1.75}
          className={`text-muted mt-1 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="border-t border-[var(--card-border)] px-4 py-3 space-y-1">
          {day.drills.map((drill, idx) => (
            <HistoryDrillRow key={idx} drill={drill} />
          ))}
          {day.assignmentId && (
            <Link
              href={`/athlete/throws/session/${day.assignmentId}`}
              className="mt-2 block text-center py-2 px-3 rounded-lg bg-primary-500/10 text-primary-500 text-sm font-semibold hover:bg-primary-500/20 transition-colors"
            >
              View full session →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
