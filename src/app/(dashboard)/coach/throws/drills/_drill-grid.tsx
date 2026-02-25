"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DrillFormModal } from "./_drill-form-modal";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type DrillItem = {
  id: string;
  name: string;
  description: string | null;
  videoUrl: string | null;
  event: string | null;
  category: string;
  implementKg: number | null;
  difficulty: string | null;
  cues: string[];
  athleteTypes: string[];
  isGlobal: boolean;
  isOwn: boolean;
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const CATEGORY_LABELS: Record<string, string> = {
  CE: "Competitive",
  SDE: "Spec. Developmental",
  SPE: "Spec. Preparatory",
  GPE: "General Preparatory",
};

const DIFFICULTY_COLORS: Record<string, "success" | "warning" | "danger"> = {
  beginner: "success",
  intermediate: "warning",
  advanced: "danger",
};

const TYPE_LABELS: Record<string, string> = {
  EXPLOSIVE: "Explosive",
  SPEED_STRENGTH: "Speed Strength",
  STRENGTH_SPEED: "Strength Speed",
  STRENGTH: "Strength",
};

/* ─── Component ──────────────────────────────────────────────────────────── */

export function DrillGrid({ drills }: { drills: DrillItem[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingDrill, setEditingDrill] = useState<DrillItem | null>(null);
  const [deletingDrill, setDeletingDrill] = useState<DrillItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  function handleEdit(drill: DrillItem) {
    setEditingDrill(drill);
    setFormOpen(true);
  }

  function handleCreate() {
    setEditingDrill(null);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!deletingDrill) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/coach/throws/drills/${deletingDrill.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
        setDeletingDrill(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Add button */}
      <div className="flex justify-end">
        <Button onClick={handleCreate}>+ Add Drill</Button>
      </div>

      {/* Grid */}
      {drills.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-sm text-muted">
            No drills match your filters. Try adjusting or add a custom drill.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drills.map((drill) => (
            <div
              key={drill.id}
              className="card p-4 space-y-3 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--foreground)] leading-tight">
                    {drill.name}
                  </p>
                  {drill.isGlobal && (
                    <span className="text-[10px] text-muted">Built-in</span>
                  )}
                </div>
                {drill.isOwn && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(drill)}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Edit
                    </button>
                    <span className="text-xs text-muted">·</span>
                    <button
                      type="button"
                      onClick={() => setDeletingDrill(drill)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1">
                <Badge variant="neutral">
                  {CATEGORY_LABELS[drill.category] ?? drill.category}
                </Badge>
                {drill.event && (
                  <Badge variant="info">
                    {formatEventName(drill.event)}
                  </Badge>
                )}
                {drill.difficulty && (
                  <Badge variant={DIFFICULTY_COLORS[drill.difficulty] ?? "neutral"}>
                    {drill.difficulty.charAt(0).toUpperCase() + drill.difficulty.slice(1)}
                  </Badge>
                )}
                {drill.implementKg != null && (
                  <Badge variant="neutral">{drill.implementKg}kg</Badge>
                )}
              </div>

              {/* Description */}
              {drill.description && (
                <p className="text-xs text-muted line-clamp-2 flex-1">
                  {drill.description}
                </p>
              )}

              {/* Cues */}
              {drill.cues.length > 0 && (
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted font-semibold uppercase tracking-wider">
                    Cues
                  </p>
                  <ul className="space-y-0.5">
                    {drill.cues.slice(0, 3).map((cue, i) => (
                      <li key={i} className="text-xs text-[var(--foreground)] flex items-start gap-1">
                        <span className="text-primary-500 shrink-0">•</span>
                        <span className="line-clamp-1">{cue}</span>
                      </li>
                    ))}
                    {drill.cues.length > 3 && (
                      <li className="text-[10px] text-muted">
                        +{drill.cues.length - 3} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Athlete types */}
              {drill.athleteTypes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {drill.athleteTypes.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-muted"
                    >
                      {TYPE_LABELS[t] ?? t}
                    </span>
                  ))}
                </div>
              )}

              {/* Video link */}
              {drill.videoUrl && (
                <a
                  href={drill.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-auto"
                >
                  Watch Video →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      <DrillFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingDrill(null);
        }}
        editDrill={editingDrill}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletingDrill}
        onClose={() => setDeletingDrill(null)}
        onConfirm={handleDelete}
        title="Delete Drill"
        description={`Are you sure you want to delete "${deletingDrill?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
