"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, DataTable, Button, ConfirmDialog, useToast } from "@/components";
import type { Column } from "@/components";
import type { ExerciseItem } from "@/lib/data/coach";
import { ExerciseModal } from "./_exercise-modal";
import { csrfHeaders } from "@/lib/csrf-client";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const CATEGORY_LABELS: Record<string, { label: string; variant: "danger" | "warning" | "neutral" | "success" }> = {
  CE:  { label: "CE",  variant: "danger"  },
  SDE: { label: "SDE", variant: "warning" },
  SPE: { label: "SPE", variant: "neutral" },
  GPE: { label: "GPE", variant: "success" },
};

const CATEGORIES = ["All", "CE", "SDE", "SPE", "GPE"] as const;

/* ─── Cell Renderers ──────────────────────────────────────────────────────── */

function NameCell({ row }: { row: ExerciseItem }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-[var(--foreground)] truncate">
          {row.name}
        </p>
        {row.isGlobal && (
          <span title="System exercise">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-surface-400 shrink-0"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
        )}
      </div>
      {row.description && (
        <p className="text-xs text-muted truncate mt-0.5">{row.description}</p>
      )}
    </div>
  );
}

function CategoryCell({ row }: { row: ExerciseItem }) {
  const cfg = CATEGORY_LABELS[row.category];
  if (!cfg) return <span className="text-muted text-sm">{row.category}</span>;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function EventCell({ row }: { row: ExerciseItem }) {
  if (!row.event) return <span className="text-muted text-sm">—</span>;
  return <span className="text-sm">{formatEventName(row.event)}</span>;
}

function EquipmentCell({ row }: { row: ExerciseItem }) {
  if (!row.equipment) return <span className="text-muted text-sm">—</span>;
  return (
    <span className="text-sm capitalize">{row.equipment}</span>
  );
}

function WeightCell({ row }: { row: ExerciseItem }) {
  if (row.implementWeight == null) return <span className="text-muted text-sm">—</span>;
  return <span className="text-sm tabular-nums font-medium">{row.implementWeight}kg</span>;
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

export function ExercisesTable({ exercises }: { exercises: ExerciseItem[] }) {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExerciseItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Filter by category tab
  const filtered = activeCategory === "All"
    ? exercises
    : exercises.filter((e) => e.category === activeCategory);

  function handleEdit(exercise: ExerciseItem) {
    setEditingExercise(exercise);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditingExercise(null);
    setModalOpen(true);
  }

  function handleCloseModal() {
    setModalOpen(false);
    setEditingExercise(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/coach/exercises/${deleteTarget.id}`, { method: "DELETE", headers: csrfHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toastError("Delete failed", data.error ?? "Failed to delete exercise.");
        return;
      }
      router.refresh();
    } catch {
      toastError("Delete failed", "An unexpected error occurred. Please try again.");
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  }

  const columns: Column<ExerciseItem>[] = [
    {
      key: "name",
      header: "Exercise",
      cell: (row) => <NameCell row={row} />,
      sortable: true,
    },
    {
      key: "category",
      header: "Category",
      cell: (row) => <CategoryCell row={row} />,
      sortable: true,
    },
    {
      key: "event",
      header: "Event",
      cell: (row) => <EventCell row={row} />,
      hideOnMobile: true,
    },
    {
      key: "equipment",
      header: "Equipment",
      cell: (row) => <EquipmentCell row={row} />,
      hideOnMobile: true,
    },
    {
      key: "implementWeight",
      header: "Weight",
      cell: (row) => <WeightCell row={row} />,
      sortable: true,
      hideOnMobile: true,
    },
    {
      key: "id",
      header: "",
      cell: (row) => (
        <div className="flex items-center gap-2 justify-end">
          {row.isOwn && !row.isGlobal && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
                className="text-sm text-red-600 dark:text-red-400 hover:underline font-medium"
              >
                Delete
              </button>
            </>
          )}
        </div>
      ),
      className: "w-28",
    },
  ];

  return (
    <>
      {/* Category Tabs */}
      <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-800/50 rounded-xl p-1 w-fit">
        {CATEGORIES.map((cat) => {
          const count = cat === "All" ? exercises.length : exercises.filter((e) => e.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-white dark:bg-surface-700 text-[var(--foreground)] shadow-sm"
                  : "text-muted hover:text-[var(--foreground)]"
              }`}
            >
              {cat}
              <span className="ml-1.5 text-xs text-muted">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <DataTable
        data={filtered}
        columns={columns}
        rowKey="id"
        searchable
        searchPlaceholder="Search exercises..."
        pageSize={25}
        emptyTitle="No exercises found"
        emptyDescription={
          activeCategory !== "All"
            ? `No ${activeCategory} exercises. Try a different category or add a custom one.`
            : "Add custom exercises to get started."
        }
        actions={
          <Button variant="primary" size="sm" onClick={handleAdd}>
            + Add Exercise
          </Button>
        }
      />

      {/* Add/Edit Modal */}
      <ExerciseModal
        open={modalOpen}
        onClose={handleCloseModal}
        exercise={editingExercise}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Exercise"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
      />
    </>
  );
}
