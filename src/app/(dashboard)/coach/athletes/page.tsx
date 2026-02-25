import Link from "next/link";
import { Avatar, Badge, DataTable, type Column } from "@/components";
import { InviteAthleteButton } from "./_invite";
import {
  requireCoachSession,
  getAthleteRoster,
  PLAN_LIMITS,
  type AthleteRosterItem,
} from "@/lib/data/coach";
import type { PlanName } from "@/lib/stripe";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

/* ─── Cell Renderers ─────────────────────────────────────────────────────── */

function AthleteCell({ row }: { row: AthleteRosterItem }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar
        name={`${row.firstName} ${row.lastName}`}
        src={row.avatarUrl}
        size="sm"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)] truncate">
          {row.firstName} {row.lastName}
        </p>
      </div>
    </div>
  );
}

function EventsCell({ row }: { row: AthleteRosterItem }) {
  if (row.events.length === 0) {
    return <span className="text-muted text-sm">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {row.events.map((e) => (
        <Badge key={e} variant="neutral">
          {formatEventName(e)}
        </Badge>
      ))}
    </div>
  );
}

function ReadinessCell({ row }: { row: AthleteRosterItem }) {
  const r = row.latestReadiness;
  if (!r) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[var(--card-border)] shrink-0" />
        <span className="text-muted text-sm">No check-in</span>
      </div>
    );
  }

  const dotColor =
    r.score >= 8 ? "bg-emerald-500" : r.score >= 5 ? "bg-amber-500" : "bg-red-500";

  const dateDiff = Math.floor((Date.now() - new Date(r.date).getTime()) / (1000 * 60 * 60 * 24));
  const dateLabel = dateDiff === 0 ? "Today" : dateDiff === 1 ? "Yesterday" : `${dateDiff}d ago`;
  const isStale = dateDiff > 2;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
      <span className="text-sm font-bold tabular-nums">{r.score.toFixed(1)}</span>
      {r.score < 5 && <Badge variant="danger">Low</Badge>}
      {r.injuryStatus === "ACTIVE" && <Badge variant="danger">Injured</Badge>}
      {r.injuryStatus === "MONITORING" && <Badge variant="warning">Watch</Badge>}
      <span className={`text-xs tabular-nums ${isStale ? "text-amber-600 dark:text-amber-400" : "text-muted"}`}>
        {dateLabel}
      </span>
    </div>
  );
}

function StreakCell({ row }: { row: AthleteRosterItem }) {
  if (row.currentStreak === 0) return <span className="text-muted text-sm">—</span>;
  return (
    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
      🔥 {row.currentStreak}
    </span>
  );
}

function ActionCell({ row }: { row: AthleteRosterItem }) {
  return (
    <Link
      href={`/coach/athletes/${row.id}`}
      className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
    >
      View →
    </Link>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function AthletesPage() {
  const { coach } = await requireCoachSession();
  const roster = await getAthleteRoster(coach.id);
  const planLimit = PLAN_LIMITS[coach.plan];

  // Sort: lowest readiness first (needs attention), no check-in last
  const sorted = [...roster].sort((a, b) => {
    const aScore = a.latestReadiness?.score ?? 999;
    const bScore = b.latestReadiness?.score ?? 999;
    if (aScore !== bScore) return aScore - bScore;
    return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
  });

  const lowCount = roster.filter((a) => a.latestReadiness && a.latestReadiness.score < 5).length;
  const noCheckInCount = roster.filter((a) => !a.latestReadiness).length;
  const needsAttention = lowCount + noCheckInCount;

  const columns: Column<AthleteRosterItem>[] = [
    {
      key: "firstName",
      header: "Athlete",
      cell: (row) => <AthleteCell row={row} />,
      sortable: true,
    },
    {
      key: "events",
      header: "Events",
      cell: (row) => <EventsCell row={row} />,
      hideOnMobile: true,
    },
    {
      key: "latestReadiness",
      header: "Readiness",
      cell: (row) => <ReadinessCell row={row} />,
    },
    {
      key: "currentStreak",
      header: "Streak",
      cell: (row) => <StreakCell row={row} />,
      sortable: true,
      hideOnMobile: true,
    },
    {
      key: "lastSessionDate",
      header: "Last Session",
      cell: (row) => (
        <span className="text-sm text-muted tabular-nums">
          {formatRelativeDate(row.lastSessionDate)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "id",
      header: "",
      cell: (row) => <ActionCell row={row} />,
      className: "w-20",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Athletes
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {roster.length}{" "}
            {roster.length === 1 ? "athlete" : "athletes"} on your roster
          </p>
        </div>
        <InviteAthleteButton
          athleteCount={roster.length}
          planLimit={planLimit}
          currentPlan={coach.plan as PlanName}
        />
      </div>

      {/* Attention banner */}
      {needsAttention > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-3">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-400 leading-snug">
            {lowCount > 0 && noCheckInCount > 0 ? (
              <><strong>{lowCount}</strong> {lowCount === 1 ? "athlete has" : "athletes have"} low readiness and <strong>{noCheckInCount}</strong> {noCheckInCount === 1 ? "hasn't" : "haven't"} checked in recently.</>
            ) : lowCount > 0 ? (
              <><strong>{lowCount}</strong> {lowCount === 1 ? "athlete has" : "athletes have"} a readiness score below 5 — consider adjusting training load.</>
            ) : (
              <><strong>{noCheckInCount}</strong> {noCheckInCount === 1 ? "athlete hasn't" : "athletes haven't"} submitted a readiness check-in yet.</>
            )}
          </p>
        </div>
      )}

      {/* Table — sorted worst readiness first */}
      <DataTable
        data={sorted}
        columns={columns}
        rowKey="id"
        searchable
        searchPlaceholder="Search by name…"
        pageSize={25}
        emptyTitle="No athletes yet"
        emptyDescription="Invite athletes to your roster to get started."
        onRowClick={() => {
          // Handled by ActionCell link; this is a fallback for row-level clicks
        }}
      />
    </div>
  );
}
