"use client";

import Link from "next/link";
import { Avatar, Badge, DataTable, type Column } from "@/components";
import type { AthleteRosterItem } from "@/lib/data/coach";

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

/* ─── Table ──────────────────────────────────────────────────────────────── */

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

export function AthletesTable({ data }: { data: AthleteRosterItem[] }) {
  return (
    <DataTable
      data={data}
      columns={columns}
      rowKey="id"
      searchable
      searchPlaceholder="Search by name…"
      pageSize={25}
      emptyTitle="No athletes yet"
      emptyDescription="Invite athletes to your roster to get started."
    />
  );
}
