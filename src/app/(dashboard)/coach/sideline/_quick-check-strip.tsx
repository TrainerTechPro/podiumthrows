"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, AlertTriangle, MessageSquarePlus, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Sheet } from "@/components/ui/Sheet";
import type { SidelineRosterAthlete } from "@/lib/data/sideline";

function formatRelative(iso: string | null): string {
  if (!iso) return "No logs yet";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 1) return `${days} days ago`;
  if (days === 1) return "Yesterday";
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "Just now";
}

function readinessColor(score: number | null, max: number): string {
  if (score === null) return "var(--color-text-secondary)";
  const pct = (score / max) * 100;
  if (pct >= 70) return "var(--color-status-success-fg)";
  if (pct >= 40) return "var(--color-status-warning-fg)";
  return "var(--color-status-danger-fg)";
}

export function QuickCheckStrip({ roster }: { roster: SidelineRosterAthlete[] }) {
  const [active, setActive] = useState<SidelineRosterAthlete | null>(null);

  if (roster.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">No athletes on your roster yet.</p>
    );
  }

  return (
    <>
      <div className="-mx-4 px-4 overflow-x-auto custom-scrollbar">
        <ul className="flex gap-3 snap-x snap-mandatory">
          {roster.map((a) => {
            const color = readinessColor(a.readinessScore, a.readinessMax);
            const isInjured = a.injuryStatus === "ACTIVE";
            return (
              <li key={a.athleteId} className="snap-start shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(a)}
                  className="w-[112px] flex flex-col items-center gap-2 rounded-2xl p-3 bg-[var(--card-bg)] border border-[var(--card-border)] active:scale-[0.97] transition-transform focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50"
                  aria-label={`Quick check ${a.firstName} ${a.lastName}`}
                >
                  <div className="relative">
                    <Avatar name={`${a.firstName} ${a.lastName}`} src={a.avatarUrl} size="lg" />
                    {isInjured && (
                      <span
                        className="absolute -top-0.5 -right-0.5 rounded-full p-1 bg-[var(--color-status-danger-bg)] border-2 border-[var(--card-bg)]"
                        aria-label="Injury flag"
                      >
                        <AlertTriangle
                          size={10}
                          strokeWidth={2.5}
                          style={{ color: "var(--color-status-danger-fg)" }}
                          aria-hidden="true"
                        />
                      </span>
                    )}
                  </div>
                  <div className="text-center min-w-0 w-full">
                    <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                      {a.firstName}
                    </p>
                    <p className="text-xs font-semibold tabular-nums mt-0.5" style={{ color }}>
                      {a.readinessScore !== null
                        ? `${a.readinessScore.toFixed(1)} / ${a.readinessMax}`
                        : "No check-in"}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Sheet
        open={!!active}
        onClose={() => setActive(null)}
        side="bottom"
        size="md"
        title={active ? `${active.firstName} ${active.lastName}` : "Athlete"}
        description={active?.events.join(" · ") || undefined}
      >
        {active && <AthleteSheetBody athlete={active} />}
      </Sheet>
    </>
  );
}

function AthleteSheetBody({ athlete }: { athlete: SidelineRosterAthlete }) {
  const color = readinessColor(athlete.readinessScore, athlete.readinessMax);
  const isInjured = athlete.injuryStatus === "ACTIVE";

  return (
    <div className="space-y-5">
      {isInjured && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
          style={{
            backgroundColor: "var(--color-status-danger-bg)",
            color: "var(--color-status-danger-fg)",
          }}
        >
          <AlertTriangle
            size={14}
            strokeWidth={1.75}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          <span className="font-medium">Active injury flag</span>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
            <Heart size={12} strokeWidth={1.75} aria-hidden="true" />
            Readiness
          </dt>
          <dd className="text-2xl font-bold tabular-nums" style={{ color }}>
            {athlete.readinessScore !== null ? athlete.readinessScore.toFixed(1) : "—"}
            <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-1">
              / {athlete.readinessMax}
            </span>
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs font-medium text-[var(--color-text-secondary)]">Last log</dt>
          <dd className="text-sm font-semibold text-[var(--foreground)]">
            {formatRelative(athlete.lastLogAt)}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2">
        <Link
          href={`/coach/athletes/${athlete.athleteId}#add-note`}
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-primary-500 text-surface-950 font-semibold text-sm active:scale-[0.97] transition-transform"
        >
          <span className="flex items-center gap-2">
            <MessageSquarePlus size={16} strokeWidth={1.75} aria-hidden="true" />
            Add note
          </span>
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <Link
          href={`/coach/athletes/${athlete.athleteId}`}
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] font-medium text-sm active:scale-[0.97] transition-transform"
        >
          <span>Open profile</span>
          <ChevronRight
            size={16}
            strokeWidth={1.75}
            aria-hidden="true"
            style={{ color: "var(--color-text-secondary)" }}
          />
        </Link>
      </div>
    </div>
  );
}
