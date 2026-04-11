"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, UserRoundPlus } from "lucide-react";
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
        <p className="text-sm font-semibold text-[var(--foreground)] truncate flex items-center">
          <span className="truncate">
            {row.firstName} {row.lastName}
          </span>
          {!row.claimedAt && (
            <span
              className="ml-1.5 inline-flex shrink-0"
              title="Profile managed by coach — not yet claimed by athlete"
            >
              <UserRoundPlus
                size={14}
                strokeWidth={1.75}
                className="text-[var(--muted)] opacity-60"
                aria-hidden="true"
              />
            </span>
          )}
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

/**
 * Mini 4-bar breakdown of readiness sub-scores. Each bar's height represents
 * the *wellness* value of that dimension on a unified "higher = better" scale:
 * soreness/stress are inverted (11 - raw) so a coach can glance at a row and
 * immediately see which factor is dragging the overall score down.
 */
function ReadinessBreakdown({
  sleep,
  soreness,
  stress,
  energy,
}: {
  sleep: number;
  soreness: number;
  stress: number;
  energy: number;
}) {
  // Normalize: all factors on 1-10 where higher = better.
  const factors = [
    { label: "Sleep", raw: sleep, wellness: sleep },
    { label: "Soreness", raw: soreness, wellness: 11 - soreness },
    { label: "Stress", raw: stress, wellness: 11 - stress },
    { label: "Energy", raw: energy, wellness: energy },
  ];

  return (
    <div
      className="flex items-end gap-0.5 h-3.5"
      aria-hidden="true"
    >
      {factors.map((f) => {
        const color =
          f.wellness >= 8
            ? "bg-emerald-500"
            : f.wellness >= 5
              ? "bg-amber-500"
              : "bg-red-500";
        // Height: min 2px (so zero isn't invisible), scales up to 14px.
        const heightPx = 2 + Math.round((f.wellness / 10) * 12);
        return (
          <span
            key={f.label}
            title={`${f.label}: ${f.raw}/10`}
            className={`w-[3px] rounded-sm ${color}`}
            style={{ height: `${heightPx}px` }}
          />
        );
      })}
    </div>
  );
}

function ReadinessCell({ row }: { row: AthleteRosterItem }) {
  const r = row.latestReadiness;
  if (!r) {
    return <span className="text-muted text-sm">—</span>;
  }

  const dotColor =
    r.score >= 8 ? "bg-emerald-500" : r.score >= 5 ? "bg-amber-500" : "bg-red-500";

  // Show only the highest-priority status
  const statusBadge =
    r.injuryStatus === "ACTIVE" ? (
      <Badge variant="danger">Injured</Badge>
    ) : r.injuryStatus === "MONITORING" ? (
      <Badge variant="warning">Watch</Badge>
    ) : r.score < 5 ? (
      <Badge variant="danger">Low</Badge>
    ) : null;

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
      <span className="text-sm font-semibold tabular-nums">{r.score.toFixed(1)}</span>
      <ReadinessBreakdown
        sleep={r.sleepQuality}
        soreness={r.soreness}
        stress={r.stressLevel}
        energy={r.energyMood}
      />
      <span className="sr-only">
        Sleep {r.sleepQuality} of 10, soreness {r.soreness} of 10, stress{" "}
        {r.stressLevel} of 10, energy {r.energyMood} of 10.
      </span>
      {statusBadge}
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

function ActionCell() {
  // Whole row is clickable (see AthletesTable below). This is a visual
  // affordance only — no own click handler, no Link.
  return (
    <ChevronRight
      size={18}
      strokeWidth={1.75}
      className="text-muted"
      aria-hidden="true"
    />
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
    cell: (row) =>
      !row.claimedAt && !row.lastSessionDate ? (
        <Link
          href={`/coach/athletes/${row.id}`}
          className="text-xs text-primary-500 hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          Invite →
        </Link>
      ) : (
        <span className="text-sm text-muted tabular-nums">
          {formatRelativeDate(row.lastSessionDate)}
        </span>
      ),
    hideOnMobile: true,
  },
  {
    key: "id",
    header: "",
    cell: () => <ActionCell />,
    className: "w-10 text-right",
  },
];

function getRowClassName(row: AthleteRosterItem): string | undefined {
  const r = row.latestReadiness;
  if (r?.injuryStatus === "ACTIVE") return "border-l-4 border-l-red-500";
  if (r && r.score < 5) return "border-l-4 border-l-amber-500";
  if (!r) return "border-l-4 border-l-surface-400 dark:border-l-surface-500";
  return undefined;
}

export function AthletesTable({ data }: { data: AthleteRosterItem[] }) {
  const router = useRouter();
  return (
    <DataTable
      data={data}
      columns={columns}
      rowKey="id"
      searchable
      searchPlaceholder="Search by name…"
      pageSize={25}
      rowClassName={getRowClassName}
      onRowClick={(row) => router.push(`/coach/athletes/${row.id}`)}
      emptyTitle="No athletes on your roster"
      emptyDescription="Send an invite to get your first athlete set up. They'll appear here once they accept."
    />
  );
}
