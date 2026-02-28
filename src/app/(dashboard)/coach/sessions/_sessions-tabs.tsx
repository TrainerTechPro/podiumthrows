"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Tabs, TabList, TabTrigger, TabPanel,
  DataTable, Badge, Avatar, Button, ConfirmDialog, EmptyState,
  useToast,
} from "@/components";
import type { Column } from "@/components";
import type { WorkoutPlanItem, CoachSessionItem } from "@/lib/data/coach";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

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

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" | "info" }> = {
  SCHEDULED: { label: "Scheduled", variant: "info" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  SKIPPED: { label: "Skipped", variant: "neutral" },
};

/* ─── Sessions Columns ──────────────────────────────────────────────────── */

const sessionColumns: Column<CoachSessionItem>[] = [
  {
    key: "athleteFirstName",
    header: "Athlete",
    cell: (row) => (
      <div className="flex items-center gap-2">
        <Avatar
          name={`${row.athleteFirstName} ${row.athleteLastName}`}
          src={row.athleteAvatarUrl}
          size="sm"
        />
        <span className="font-medium">
          {row.athleteFirstName} {row.athleteLastName}
        </span>
      </div>
    ),
  },
  {
    key: "planName",
    header: "Workout Plan",
    cell: (row) => (
      <span className="text-muted">{row.planName ?? "—"}</span>
    ),
  },
  {
    key: "scheduledDate",
    header: "Date",
    sortable: true,
    cell: (row) => formatDate(row.scheduledDate),
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => {
      const s = STATUS_BADGE[row.status] ?? { label: row.status, variant: "neutral" as const };
      return <Badge variant={s.variant}>{s.label}</Badge>;
    },
  },
  {
    key: "rpe",
    header: "RPE",
    hideOnMobile: true,
    cell: (row) =>
      row.rpe !== null ? (
        <span className="tabular-nums font-medium">{row.rpe}</span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
];

/* ─── Component ───────────────────────────────────────────────────────────── */

export function SessionsTabs({
  sessions,
  plans,
}: {
  sessions: CoachSessionItem[];
  plans: WorkoutPlanItem[];
}) {
  const router = useRouter();
  const { error: toastError, success: toastSuccess } = useToast();
  const [cloneLoading, setCloneLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleClone(planId: string) {
    setCloneLoading(planId);
    try {
      const res = await fetch(`/api/coach/plans/${planId}/clone`, { method: "POST" });
      if (res.ok) {
        toastSuccess("Plan cloned", "A copy has been added to your plans.");
        router.refresh();
      } else {
        toastError("Clone failed", "Could not duplicate the plan. Please try again.");
      }
    } finally {
      setCloneLoading(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/coach/plans/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteTarget(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toastError("Delete failed", data.error ?? "Failed to delete plan.");
        setDeleteTarget(null);
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  const upcomingSessions = sessions.filter(
    (s) => s.status === "SCHEDULED" || s.status === "IN_PROGRESS"
  );
  const recentSessions = sessions.filter(
    (s) => s.status === "COMPLETED" || s.status === "SKIPPED"
  );

  const planColumns: Column<WorkoutPlanItem>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.name}</span>
          {row.isTemplate && <Badge variant="primary">Template</Badge>}
        </div>
      ),
    },
    {
      key: "event",
      header: "Event",
      hideOnMobile: true,
      cell: (row) =>
        row.event ? (
          <Badge variant="neutral">{formatEventName(row.event)}</Badge>
        ) : (
          <span className="text-muted">General</span>
        ),
    },
    {
      key: "blockCount",
      header: "Blocks",
      cell: (row) => <span className="tabular-nums">{row.blockCount}</span>,
    },
    {
      key: "sessionCount",
      header: "Sessions",
      hideOnMobile: true,
      cell: (row) => <span className="tabular-nums">{row.sessionCount}</span>,
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => formatDate(row.createdAt),
    },
    {
      key: "actions",
      header: "",
      className: "w-28",
      cell: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleClone(row.id)}
            loading={cloneLoading === row.id}
            disabled={cloneLoading !== null}
          >
            Clone
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget({ id: row.id, name: row.name })}
            className="text-danger-600 dark:text-danger-400 hover:text-danger-700"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Workout Plan"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
      />

      <Tabs defaultTab="upcoming">
        <TabList variant="underline" className="mb-6">
          <TabTrigger id="upcoming" variant="underline">
            Upcoming
            {upcomingSessions.length > 0 && (
              <Badge variant="primary">{upcomingSessions.length}</Badge>
            )}
          </TabTrigger>
          <TabTrigger id="recent" variant="underline">
            Recent
          </TabTrigger>
          <TabTrigger id="plans" variant="underline">
            Workout Plans
            <Badge variant="neutral">{plans.length}</Badge>
          </TabTrigger>
        </TabList>

        {/* Upcoming Sessions */}
        <TabPanel id="upcoming">
          {upcomingSessions.length === 0 ? (
            <EmptyState
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              }
              title="No upcoming sessions"
              description="Create a workout plan and assign it to athletes to see upcoming sessions here."
              action={
                <Button variant="primary" onClick={() => router.push("/coach/sessions/new")}>
                  New Session
                </Button>
              }
            />
          ) : (
            <DataTable
              data={upcomingSessions}
              columns={sessionColumns}
              rowKey="id"
              searchable
              searchPlaceholder="Search athletes..."
            />
          )}
        </TabPanel>

        {/* Recent Sessions */}
        <TabPanel id="recent">
          {recentSessions.length === 0 ? (
            <EmptyState
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              }
              title="No completed sessions yet"
              description="Sessions will appear here once athletes complete their workouts."
            />
          ) : (
            <DataTable
              data={recentSessions}
              columns={sessionColumns}
              rowKey="id"
              searchable
              searchPlaceholder="Search athletes..."
            />
          )}
        </TabPanel>

        {/* Workout Plans */}
        <TabPanel id="plans">
          {plans.length === 0 ? (
            <EmptyState
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              }
              title="No workout plans"
              description="Create your first workout plan to build and reuse structured training sessions."
              action={
                <Button variant="primary" onClick={() => router.push("/coach/sessions/new")}>
                  Create Plan
                </Button>
              }
            />
          ) : (
            <DataTable
              data={plans}
              columns={planColumns}
              rowKey="id"
              searchable
              searchPlaceholder="Search plans..."
            />
          )}
        </TabPanel>
      </Tabs>
    </>
  );
}
