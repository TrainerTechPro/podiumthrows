"use client";

import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  COMPETITION_WEIGHTS,
  EVENT_CODE_MAP,
  GENDER_CODE_MAP,
  EVENTS,
} from "@/lib/throws/constants";
import type { EventType, Gender } from "@prisma/client";
import { formatImplementDisplay } from "@/lib/throws/display";
import type { ThrowsPRRecord } from "./_types";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const KG_PER_LB = 0.45359237;

/** Extract numeric kg from an implement label. Handles legacy formats
 *  ("9kg", "800g", "7.26kg") AND catalog displayLabels ("14 lb", "600 g",
 *  "7.26 kg") with optional spaces. Returns 0 on parse failure. */
function parseWeightKg(implement: string): number {
  const lower = implement.toLowerCase().trim();
  // Try lb / lbs first — catalog uses "14 lb"; legacy used "14lbs".
  const lbMatch = lower.match(/([\d.]+)\s*lbs?\b/);
  if (lbMatch) return parseFloat(lbMatch[1]) * KG_PER_LB;
  // kg with optional space.
  const kgMatch = lower.match(/([\d.]+)\s*kg\b/);
  if (kgMatch) return parseFloat(kgMatch[1]);
  // grams (javelin).
  const gMatch = lower.match(/([\d.]+)\s*g\b/);
  if (gMatch) return parseFloat(gMatch[1]) / 1000;
  return 0;
}

/** Get competition weight in kg for a given event + gender */
function getCompWeight(event: EventType, gender: Gender): number | null {
  const eventCode = EVENT_CODE_MAP[event as keyof typeof EVENT_CODE_MAP];
  const genderCode = GENDER_CODE_MAP[gender as keyof typeof GENDER_CODE_MAP];
  if (!eventCode || !genderCode) return null;
  return COMPETITION_WEIGHTS[eventCode]?.[genderCode] ?? null;
}

/** Determine if an implement IS the competition weight */
function isCompetitionWeight(implementKg: number, compWeightKg: number): boolean {
  // Allow small floating point tolerance
  return Math.abs(implementKg - compWeightKg) < 0.01;
}

/** Get ratio color class based on transfer ratio */
function getRatioColor(ratio: number): string {
  if (ratio >= 85 && ratio <= 115) return "text-emerald-600 dark:text-emerald-400";
  if ((ratio >= 75 && ratio < 85) || (ratio > 115 && ratio <= 125))
    return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/* ─── Types ──────────────────────────────────────────────────────────────── */

type ProcessedPR = ThrowsPRRecord & {
  weightKg: number;
  isComp: boolean;
  differential: number | null;
  ratio: number | null;
};

/* ─── Component ──────────────────────────────────────────────────────────── */

interface TabImplementsProps {
  throwsPRs: ThrowsPRRecord[];
  events: EventType[];
  gender: Gender;
}

export function TabImplements({ throwsPRs, events, gender }: TabImplementsProps) {
  /* ── Empty state ───────────────────────────────────────────────────── */

  if (throwsPRs.length === 0) {
    return (
      <EmptyState
        icon={<Scale strokeWidth={1.75} aria-hidden="true" />}
        title="No Implement PRs Recorded"
        description="Implement personal records will appear here once throws are logged. PRs are tracked per event and implement weight."
      />
    );
  }

  /* ── Group PRs by event ────────────────────────────────────────────── */

  const prsByEvent = new Map<string, ThrowsPRRecord[]>();
  for (const pr of throwsPRs) {
    const existing = prsByEvent.get(pr.event) ?? [];
    existing.push(pr);
    prsByEvent.set(pr.event, existing);
  }

  /* ── Render only events the athlete has selected ───────────────────── */

  const eventsToShow = events.filter(
    (ev) => prsByEvent.has(ev) && (prsByEvent.get(ev)?.length ?? 0) > 0
  );

  if (eventsToShow.length === 0) {
    return (
      <EmptyState
        icon={<Scale strokeWidth={1.75} aria-hidden="true" />}
        title="No Implement PRs Recorded"
        description="Implement personal records will appear here once throws are logged for your selected events."
      />
    );
  }

  return (
    <div className="space-y-4">
      {eventsToShow.map((event) => {
        const prs = prsByEvent.get(event) ?? [];
        const compWeight = getCompWeight(event, gender);

        // Find competition implement PR for differential calculations
        const compPR = compWeight
          ? prs.find((pr) => isCompetitionWeight(parseWeightKg(pr.implement), compWeight))
          : null;

        // Process PRs: add weight parsing, sort DESCENDING by weight (Bondarchuk)
        const processed: ProcessedPR[] = prs
          .map((pr) => {
            const weightKg = parseWeightKg(pr.implement);
            const isComp = compWeight != null && isCompetitionWeight(weightKg, compWeight);

            let differential: number | null = null;
            let ratio: number | null = null;
            if (!isComp && compPR) {
              differential = pr.distance - compPR.distance;
              ratio = (pr.distance / compPR.distance) * 100;
            }

            return { ...pr, weightKg, isComp, differential, ratio };
          })
          .sort((a, b) => b.weightKg - a.weightKg);

        const eventMeta = EVENTS[event as keyof typeof EVENTS];

        return (
          <div
            key={event}
            className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] overflow-hidden"
          >
            {/* ── Section header ─────────────────────────────────────── */}
            <div className="px-5 py-4 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-3">
                {eventMeta && (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: eventMeta.color }}
                  />
                )}
                <h3 className="font-heading font-semibold text-[var(--foreground)]">
                  {eventMeta?.label ?? formatEventName(event)}
                </h3>
                <span className="text-xs text-muted">
                  {processed.length} implement{processed.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* ── Desktop table ──────────────────────────────────────── */}
            <div className="hidden sm:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                      Implement
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                      Best Distance
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                      vs Competition
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {processed.map((pr) => (
                    <tr
                      key={pr.id}
                      className="border-b border-[var(--card-border)] last:border-b-0 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                    >
                      <td className="px-5 py-3 font-medium text-[var(--foreground)]">
                        <span className="flex items-center gap-2">
                          {formatImplementDisplay(pr.weightKg, event, gender, { showComp: false })}
                          {pr.isComp && (
                            <span className="px-1.5 py-0.5 rounded text-nano font-bold uppercase bg-primary-500/15 text-primary-600 dark:text-primary-400">
                              Comp
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-[var(--foreground)]">
                        {pr.distance.toFixed(2)}m
                      </td>
                      <td className="px-5 py-3 text-muted">{formatDate(pr.achievedAt)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {pr.isComp ? (
                          <span className="text-muted">--</span>
                        ) : pr.differential != null && pr.ratio != null ? (
                          <span className={getRatioColor(pr.ratio)}>
                            {pr.differential >= 0 ? "+" : ""}
                            {pr.differential.toFixed(2)}m{" "}
                            <span className="text-xs opacity-75">({pr.ratio.toFixed(0)}%)</span>
                          </span>
                        ) : (
                          <span className="text-muted">No comp PR</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ───────────────────────────────────────── */}
            <div className="sm:hidden divide-y divide-[var(--card-border)]">
              {processed.map((pr) => (
                <div key={pr.id} className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-[var(--foreground)]">
                      {pr.implement}
                      {pr.isComp && (
                        <span className="px-1.5 py-0.5 rounded text-nano font-bold uppercase bg-primary-500/15 text-primary-600 dark:text-primary-400">
                          Comp
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums font-semibold text-[var(--foreground)]">
                      {pr.distance.toFixed(2)}m
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">{formatDate(pr.achievedAt)}</span>
                    {pr.isComp ? (
                      <span className="text-muted">--</span>
                    ) : pr.differential != null && pr.ratio != null ? (
                      <span className={cn("font-medium", getRatioColor(pr.ratio))}>
                        {pr.differential >= 0 ? "+" : ""}
                        {pr.differential.toFixed(2)}m ({pr.ratio.toFixed(0)}%)
                      </span>
                    ) : (
                      <span className="text-muted">No comp PR</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
