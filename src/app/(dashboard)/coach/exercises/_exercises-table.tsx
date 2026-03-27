"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge, DataTable, Button, ConfirmDialog, useToast } from "@/components";
import type { Column } from "@/components";
import type { ExerciseItem } from "@/lib/data/coach";
import { ExerciseModal } from "./_exercise-modal";
import { csrfHeaders } from "@/lib/csrf-client";
import { formatImplementWeight } from "@/lib/throws";
import { getRankedExercises } from "@/lib/throws/correlations";
import {
  DISTANCE_BANDS,
  EVENTS,
  EVENT_CODE_MAP,
  GENDER_CODE_MAP,
  type ThrowEvent,
  type Gender,
} from "@/lib/throws/constants";
import { TrendingUp } from "lucide-react";

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

/* ─── Correlation Helpers ─────────────────────────────────────────────────── */

const EVENT_FILTER_OPTIONS: { value: ThrowEvent; label: string }[] = [
  { value: "SHOT_PUT", label: EVENTS.SHOT_PUT.label },
  { value: "DISCUS", label: EVENTS.DISCUS.label },
  { value: "HAMMER", label: EVENTS.HAMMER.label },
  { value: "JAVELIN", label: EVENTS.JAVELIN.label },
];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

function getBandsForFilter(event: ThrowEvent, gender: Gender): string[] {
  const code = `${EVENT_CODE_MAP[event]}_${GENDER_CODE_MAP[gender]}`;
  return DISTANCE_BANDS[code] ?? [];
}

/** Color tier for correlation: green >= 0.75, amber >= 0.60, blue < 0.60 */
function correlationTierClasses(absR: number): { dot: string; text: string } {
  if (absR >= 0.75) return { dot: "bg-emerald-500", text: "text-emerald-500" };
  if (absR >= 0.60) return { dot: "bg-amber-500", text: "text-amber-500" };
  return { dot: "bg-blue-500", text: "text-blue-500" };
}

/** Build a map of exercise name → { correlation, absCorrelation, type } */
function buildCorrelationMap(
  event: ThrowEvent,
  gender: Gender,
  band: string
): Map<string, { correlation: number; absCorrelation: number; type: string }> {
  const eventCode = EVENT_CODE_MAP[event];
  const genderCode = GENDER_CODE_MAP[gender];
  const ranked = getRankedExercises(eventCode, genderCode, band);
  const map = new Map<string, { correlation: number; absCorrelation: number; type: string }>();
  for (const r of ranked) {
    map.set(r.exercise.toLowerCase(), {
      correlation: r.correlation,
      absCorrelation: r.absCorrelation,
      type: r.type,
    });
  }
  return map;
}

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
  return <span className="text-sm tabular-nums font-medium">{formatImplementWeight(row.implementWeight)}</span>;
}

function CorrelationCell({
  row,
  correlationMap,
}: {
  row: ExerciseItem;
  correlationMap: Map<string, { correlation: number; absCorrelation: number; type: string }>;
}) {
  const match = correlationMap.get(row.name.toLowerCase());
  if (!match) return <span className="text-muted text-sm">—</span>;

  const tier = correlationTierClasses(match.absCorrelation);
  const isHighCorrelation = match.absCorrelation >= 0.75;

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${tier.dot}`}
        aria-hidden="true"
      />
      <span
        className={`text-sm tabular-nums font-semibold ${tier.text} ${
          isHighCorrelation ? "drop-shadow-[0_0_4px_rgba(16,185,129,0.4)]" : ""
        }`}
      >
        {match.absCorrelation.toFixed(3)}
      </span>
    </div>
  );
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

  // Correlation filter state
  const [filterEvent, setFilterEvent] = useState<ThrowEvent>("SHOT_PUT");
  const [filterGender, setFilterGender] = useState<Gender>("MALE");
  const availableBands = useMemo(() => getBandsForFilter(filterEvent, filterGender), [filterEvent, filterGender]);
  const [filterBand, setFilterBand] = useState<string>(() => {
    const bands = getBandsForFilter("SHOT_PUT", "MALE");
    return bands.length > 0 ? bands[Math.floor(bands.length / 2)] : "";
  });

  // Reset band when event/gender changes if current band isn't available
  const effectiveBand = useMemo(() => {
    if (availableBands.includes(filterBand)) return filterBand;
    const mid = availableBands.length > 0 ? availableBands[Math.floor(availableBands.length / 2)] : "";
    return mid;
  }, [availableBands, filterBand]);

  // Build correlation lookup map
  const correlationMap = useMemo(
    () => (effectiveBand ? buildCorrelationMap(filterEvent, filterGender, effectiveBand) : new Map<string, { correlation: number; absCorrelation: number; type: string }>()),
    [filterEvent, filterGender, effectiveBand]
  );

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

  // Format filter context label
  const eventLabel = EVENTS[filterEvent].label;
  const genderLabel = filterGender === "MALE" ? "Male" : "Female";
  const bandLabel = effectiveBand ? `${effectiveBand}m` : "—";

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
      key: "correlationData",
      header: "Correlation",
      cell: (row) => <CorrelationCell row={row} correlationMap={correlationMap} />,
      hideOnMobile: true,
      className: "w-28 text-right",
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
      {/* Correlation Context Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-surface-100 dark:bg-surface-800/50 border border-[var(--card-border)]">
        <TrendingUp size={16} strokeWidth={1.75} className="text-primary-500 shrink-0" aria-hidden="true" />
        <span className="text-xs font-semibold text-muted uppercase tracking-wider shrink-0">
          Correlations
        </span>

        <select
          className="input !py-1 !px-2 !text-sm !w-auto"
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value as ThrowEvent)}
          aria-label="Event filter"
        >
          {EVENT_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          className="input !py-1 !px-2 !text-sm !w-auto"
          value={filterGender}
          onChange={(e) => setFilterGender(e.target.value as Gender)}
          aria-label="Gender filter"
        >
          {GENDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          className="input !py-1 !px-2 !text-sm !w-auto"
          value={effectiveBand}
          onChange={(e) => setFilterBand(e.target.value)}
          aria-label="Distance band filter"
        >
          {availableBands.map((band) => (
            <option key={band} value={band}>{band}m</option>
          ))}
        </select>

        <span className="hidden sm:inline text-xs text-muted ml-auto">
          Showing r values for: {eventLabel} {genderLabel} {bandLabel}
        </span>
      </div>

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
        correlationMap={correlationMap}
        filterContext={{ event: eventLabel, gender: genderLabel, band: bandLabel }}
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
