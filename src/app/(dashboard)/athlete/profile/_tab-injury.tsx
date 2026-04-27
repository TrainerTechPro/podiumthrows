"use client";

import { ShieldCheck, ShieldAlert, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ProfileData, ThrowsInjuryRecord, MovementRestrictionsData } from "./_types";

/* ─── Date formatter ───────────────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ─── Movement restriction items ───────────────────────────────────────── */

const RESTRICTION_ITEMS = [
  { key: "fullOverhead", label: "Full overhead mobility" },
  { key: "fullHipRotation", label: "Full hip rotation (both directions)" },
  { key: "deepSquat", label: "Deep squat capacity" },
  { key: "singleLegStability", label: "Single leg stability" },
] as const;

/* ─── Component ────────────────────────────────────────────────────────── */

interface TabInjuryProps {
  injuries: ThrowsInjuryRecord[];
  profile: ProfileData;
}

export function TabInjury({ injuries, profile }: TabInjuryProps) {
  const restrictions = profile.movementRestrictions;
  const activeInjuries = injuries.filter((i) => !i.recovered);
  const sortedHistory = [...injuries].sort(
    (a, b) => new Date(b.injuryDate).getTime() - new Date(a.injuryDate).getTime()
  );

  const hasAnyData = injuries.length > 0 || restrictions !== null;

  return (
    <div className="space-y-6">
      {/* ── Managed badge ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <ShieldCheck className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
        <span>Managed by your coach</span>
      </div>

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {!hasAnyData ? (
        <EmptyState
          icon={<ShieldAlert size={24} strokeWidth={1.75} aria-hidden="true" />}
          title="No injury data recorded"
          description="Your coach manages this section. Injury history and movement restrictions will appear here once they add them."
        />
      ) : (
        <>
          {/* ── Section 1: Current Limitations ─────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Current Limitations
            </h3>

            {activeInjuries.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3">
                <Check
                  className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  No current limitations
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {activeInjuries.map((injury) => (
                  <div
                    key={injury.id}
                    className={cn(
                      "card p-4 space-y-2 border-l-4",
                      injury.severity === "severe" ? "border-l-red-500" : "border-l-amber-500"
                    )}
                  >
                    {/* Header: body part + side + severity badge */}
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-[var(--foreground)]">
                        {injury.bodyPart}
                        {injury.side ? ` (${injury.side})` : ""}
                      </h4>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase",
                          injury.severity === "severe"
                            ? "bg-red-500/10 text-red-700 dark:text-red-400"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        )}
                      >
                        {injury.severity}
                      </span>
                    </div>

                    {/* Description */}
                    {injury.description && (
                      <p className="text-sm text-muted">{injury.description}</p>
                    )}

                    {/* Training impact flags */}
                    <div className="flex flex-wrap gap-1.5">
                      {injury.throwsBanned && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-700 dark:text-red-400">
                          No throwing
                        </span>
                      )}
                      {injury.heavyBanned && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-700 dark:text-red-400">
                          No heavy implements
                        </span>
                      )}
                      {injury.strengthBanned && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-700 dark:text-red-400">
                          No strength work
                        </span>
                      )}
                      {injury.modifiedLoad && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400">
                          Modified load only
                        </span>
                      )}
                    </div>

                    {/* Treatment plan */}
                    {injury.treatmentPlan && (
                      <div className="pt-2 border-t border-[var(--card-border)]">
                        <p className="text-xs text-muted">Treatment: {injury.treatmentPlan}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Section 2: Injury History ──────────────────────────── */}
          {sortedHistory.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Injury History
              </h3>

              <div className="space-y-3">
                {sortedHistory.map((injury) => (
                  <div
                    key={injury.id}
                    className={cn("card p-3 space-y-1", injury.recovered && "opacity-60")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted">{formatDate(injury.injuryDate)}</span>
                      {injury.recovered && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          Recovered
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {injury.bodyPart}
                      {injury.side ? ` (${injury.side})` : ""} &mdash; {injury.severity}
                    </p>
                    {injury.description && (
                      <p className="text-xs text-muted">{injury.description}</p>
                    )}
                    {(injury.returnToThrowDate || injury.fullReturnDate) && (
                      <p className="text-xs text-muted">
                        {injury.returnToThrowDate &&
                          `Return to throwing: ${formatDate(injury.returnToThrowDate)}`}
                        {injury.returnToThrowDate && injury.fullReturnDate && " \u00B7 "}
                        {injury.fullReturnDate &&
                          `Full return: ${formatDate(injury.fullReturnDate)}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Section 3: Movement Restrictions ──────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Movement Restrictions
            </h3>

            {restrictions === null ? (
              <p className="text-sm text-muted">No movement restrictions data recorded.</p>
            ) : (
              <div className="card p-4 space-y-3">
                {RESTRICTION_ITEMS.map((item) => {
                  const ok = restrictions[item.key as keyof MovementRestrictionsData] === true;
                  return (
                    <div key={item.key} className="flex items-center gap-3">
                      {ok ? (
                        <Check
                          className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      ) : (
                        <X className="w-4 h-4 text-red-500" strokeWidth={2} aria-hidden="true" />
                      )}
                      <span className="text-sm text-[var(--foreground)]">{item.label}</span>
                    </div>
                  );
                })}

                {restrictions.notes && (
                  <div className="pt-2 border-t border-[var(--card-border)]">
                    <p className="text-xs text-muted">{restrictions.notes}</p>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
