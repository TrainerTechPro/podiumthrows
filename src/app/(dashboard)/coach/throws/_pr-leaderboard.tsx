"use client";

import { useRouter } from "next/navigation";
import { Avatar, Badge } from "@/components";
import { DataTable, type Column } from "@/components/ui/DataTable";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type PRRow = {
  athleteId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  event: string;
  distance: number;
  implementWeight: number;
  date: string;
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/* ─── Component ──────────────────────────────────────────────────────────── */

const columns: Column<PRRow>[] = [
  {
    key: "rank",
    header: "#",
    cell: (_row, idx) => (
      <span className="text-xs font-bold text-muted tabular-nums">{idx + 1}</span>
    ),
    className: "w-10",
  },
  {
    key: "firstName",
    header: "Athlete",
    cell: (row) => (
      <div className="flex items-center gap-2">
        <Avatar name={`${row.firstName} ${row.lastName}`} src={row.avatarUrl} size="xs" />
        <span className="font-medium text-[var(--foreground)]">
          {row.firstName} {row.lastName}
        </span>
      </div>
    ),
  },
  {
    key: "event",
    header: "Event",
    cell: (row) => (
      <Badge variant="neutral">{formatEventName(row.event)}</Badge>
    ),
    hideOnMobile: true,
  },
  {
    key: "distance",
    header: "PR",
    sortable: true,
    cell: (row) => (
      <span className="font-bold tabular-nums text-[var(--foreground)]">
        {row.distance.toFixed(2)}m
      </span>
    ),
  },
  {
    key: "implementWeight",
    header: "Weight",
    cell: (row) => (
      <span className="text-muted text-xs">{row.implementWeight}kg</span>
    ),
    hideOnMobile: true,
  },
  {
    key: "date",
    header: "Date",
    cell: (row) => (
      <span className="text-muted text-xs">{formatDate(row.date)}</span>
    ),
    hideOnMobile: true,
  },
];

export function PRLeaderboard({ data }: { data: PRRow[] }) {
  const router = useRouter();

  return (
    <DataTable
      data={data}
      columns={columns}
      rowKey="athleteId"
      pageSize={10}
      emptyTitle="No PRs yet"
      emptyDescription="Athletes will appear here after logging throws."
      onRowClick={(row) => router.push(`/coach/athletes/${row.athleteId}`)}
    />
  );
}
