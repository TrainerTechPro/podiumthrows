"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DataTable, Badge, Button, ConfirmDialog, EmptyState, useToast } from "@/components";
import type { Column } from "@/components";
import type { WorkoutPlanItem } from "@/lib/data/coach";
import { csrfHeaders } from "@/lib/csrf-client";
import { FileText, ChevronRight } from "lucide-react";

const PHASE_LABELS: Record<string, string> = {
  GPP: "GPP",
  SPP: "SPP",
  COMPETITION: "Competition",
  TRANSITION: "Transition",
};

const PHASE_VARIANTS: Record<string, "primary" | "success" | "warning" | "info"> = {
  GPP: "info",
  SPP: "primary",
  COMPETITION: "warning",
  TRANSITION: "success",
};

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PlansList({ plans }: { plans: WorkoutPlanItem[] }) {
  const router = useRouter();
  const { error: toastError, success: toastSuccess } = useToast();

  const [cloneLoading, setCloneLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleClone(planId: string) {
    setCloneLoading(planId);
    try {
      const res = await fetch(`/api/coach/plans/${planId}/clone`, {
        method: "POST",
        headers: csrfHeaders(),
      });
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
      const res = await fetch(`/api/coach/plans/${deleteTarget.id}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      if (res.ok) {
        toastSuccess("Plan deleted");
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

  if (plans.length === 0) {
    return (
      <div className="card p-12">
        <EmptyState
          icon={<FileText size={28} strokeWidth={1.75} className="text-primary-500" />}
          title="No plans yet"
          description="Build a plan, then assign it to athletes to schedule sessions on their calendar."
          action={
            <Link href="/coach/plans/new">
              <Button variant="primary">Create your first plan</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const columns: Column<WorkoutPlanItem>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/coach/plans/${row.id}`}
            className="font-medium truncate hover:underline text-[var(--foreground)]"
          >
            {row.name}
          </Link>
          {row.isTemplate && <Badge variant="primary">Template</Badge>}
        </div>
      ),
    },
    {
      key: "phase",
      header: "Phase",
      hideOnMobile: true,
      cell: (row) =>
        row.phase ? (
          <Badge variant={PHASE_VARIANTS[row.phase] ?? "neutral"}>
            {PHASE_LABELS[row.phase] ?? row.phase}
          </Badge>
        ) : (
          <span className="text-muted text-xs">—</span>
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
          <span className="text-muted text-xs">General</span>
        ),
    },
    {
      key: "blockCount",
      header: "Blocks",
      cell: (row) => <span className="tabular-nums">{row.blockCount}</span>,
    },
    {
      key: "programmedSessionCount",
      header: "Scheduled",
      hideOnMobile: true,
      cell: (row) => <span className="tabular-nums text-muted">{row.programmedSessionCount}</span>,
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => <span className="text-muted text-xs">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "w-32",
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
            ? `Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone. Scheduled sessions that reference this plan will remain, but lose the link.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
      />

      <DataTable
        columns={columns}
        data={plans}
        rowKey="id"
        urlStateKey=""
        renderCard={(row) => (
          <Link href={`/coach/plans/${row.id}`} className="card-interactive card block p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[var(--foreground)] truncate">{row.name}</p>
                  {row.isTemplate && <Badge variant="primary">Template</Badge>}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  {row.phase && (
                    <Badge variant={PHASE_VARIANTS[row.phase] ?? "neutral"}>
                      {PHASE_LABELS[row.phase] ?? row.phase}
                    </Badge>
                  )}
                  {row.event && <Badge variant="neutral">{formatEventName(row.event)}</Badge>}
                </div>
                <p className="text-nano uppercase tracking-wider text-muted mt-2 tabular-nums">
                  {row.blockCount} {row.blockCount === 1 ? "block" : "blocks"} ·{" "}
                  {row.programmedSessionCount} scheduled · {formatDate(row.createdAt)}
                </p>
              </div>
              <ChevronRight
                size={18}
                strokeWidth={1.75}
                className="text-muted shrink-0 mt-0.5"
                aria-hidden="true"
              />
            </div>
          </Link>
        )}
      />
    </>
  );
}
