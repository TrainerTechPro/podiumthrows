"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, Calendar, Trophy, TrendingUp } from "lucide-react";
import { Avatar, Badge } from "@/components";
import type { AthleteRosterItem } from "@/lib/data/coach";
import { ATTENTION_META } from "./_table";

/* ─── Sideline Cards — coach mobile triage ─────────────────────────────────
   On a phone the desktop roster table compresses to the point of being
   useless on the sideline. This view replaces it. Each card is a single
   tap target — the entire surface is a Link to the athlete detail. The
   card exposes only what a coach can act on between throws: the highest
   priority signal and the next concrete action.
   ─────────────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelativeFuture(iso: string | null): string | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  const diffDays = Math.round((target - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRelativePast(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ─── The single most important signal on this card ────────────────────────
   Returns either the attention badge (if there is one) OR the strongest
   positive signal (recent PR count). Never both — one row, one decision. */
function PrimarySignal({ row }: { row: AthleteRosterItem }) {
  if (row.attentionReason) {
    const meta = ATTENTION_META[row.attentionReason];
    return <Badge variant={meta.tone}>{meta.label}</Badge>;
  }
  if (row.prsLast30d > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-300">
        <TrendingUp size={12} strokeWidth={2} aria-hidden="true" />
        {row.prsLast30d} PR{row.prsLast30d === 1 ? "" : "s"} · 30d
      </span>
    );
  }
  if (row.latestReadiness && row.latestReadiness.score >= 8) {
    return (
      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">On track</span>
    );
  }
  return null;
}

/* ─── The single most actionable next step ─────────────────────────────────
   Each branch reads like a coach sentence — what to do, when. We avoid
   listing four secondary metrics and instead pick one. */
function NextAction({ row }: { row: AthleteRosterItem }) {
  if (row.claimStatus === "PROXY") {
    return (
      <span className="text-xs font-medium text-primary-600 dark:text-primary-300">
        Send invite to claim
      </span>
    );
  }
  if (row.claimStatus === "INVITED") {
    return <span className="text-xs text-muted">Invite pending</span>;
  }
  if (row.nextSession) {
    const when = formatRelativeFuture(row.nextSession.scheduledDate);
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Calendar size={12} strokeWidth={1.75} aria-hidden="true" />
        {row.nextSession.title ? `${row.nextSession.title} — ${when}` : `Next session ${when}`}
      </span>
    );
  }
  if (row.lastSessionDate) {
    return (
      <span className="text-xs text-muted">
        Last session {formatRelativePast(row.lastSessionDate)}
      </span>
    );
  }
  if (row.lastPRDate) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Trophy size={12} strokeWidth={1.75} aria-hidden="true" />
        Last PR {formatRelativePast(row.lastPRDate)}
      </span>
    );
  }
  return <span className="text-xs text-muted">No activity yet</span>;
}

function SidelineCard({ row }: { row: AthleteRosterItem }) {
  // Border accent on the leading edge mirrors the table row accent so the
  // mobile view's priority order matches what the coach sees on desktop.
  const accent = row.attentionReason
    ? row.attentionReason === "INJURED" || row.attentionReason === "LOW_READINESS"
      ? "border-l-[3px] border-l-red-500"
      : "border-l-[3px] border-l-amber-500"
    : "border-l-[3px] border-l-transparent";

  const readiness = row.latestReadiness;
  const readinessTone =
    readiness === null
      ? "text-muted"
      : readiness.score >= 8
        ? "text-emerald-600 dark:text-emerald-400"
        : readiness.score >= 5
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400";

  return (
    <li>
      <Link
        href={`/coach/athletes/${row.id}`}
        className={`flex items-stretch gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] pl-3 pr-3 py-3 transition-colors hover:bg-[var(--color-bg-surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${accent}`}
      >
        <Avatar name={`${row.firstName} ${row.lastName}`} src={row.avatarUrl} size="md" />
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">
              {row.firstName} {row.lastName}
            </p>
            <span className={`text-sm font-semibold tabular-nums shrink-0 ${readinessTone}`}>
              {readiness ? readiness.score.toFixed(1) : "—"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {row.events.slice(0, 2).map((e) => (
              <span key={e} className="text-xs text-muted whitespace-nowrap">
                {formatEventName(e)}
              </span>
            ))}
            {row.events.length > 2 && (
              <span className="text-xs text-muted">+{row.events.length - 2}</span>
            )}
            {row.events.length > 0 && <span className="text-xs text-muted opacity-40">·</span>}
            <PrimarySignal row={row} />
          </div>

          <NextAction row={row} />
        </div>
        <ChevronRight
          size={18}
          strokeWidth={1.75}
          className="text-muted self-center shrink-0"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

export function RosterSidelineCards({ data }: { data: AthleteRosterItem[] }) {
  const [query, setQuery] = useState("");

  // Local-only fuzzy filter — the sideline use case is "tap the name fast",
  // not server search; the prop already arrives sorted by attention priority.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (a) =>
        `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
        a.events.some((e) => e.toLowerCase().includes(q))
    );
  }, [data, query]);

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find athlete…"
          aria-label="Search athletes"
          className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-muted focus:outline-none focus:border-primary-500/40 focus:ring-2 focus:ring-primary-500/20"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted py-6 text-center">
          No athletes match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((row) => (
            <SidelineCard key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}
