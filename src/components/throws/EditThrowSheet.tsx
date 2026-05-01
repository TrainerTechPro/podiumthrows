"use client";

/**
 * Edit / delete a single throw.
 *
 * Sheet-based: bottom on athlete shell, right on coach shell. Caller passes
 * the throw row to edit (no extra fetch — every page rendering history rows
 * already has the data). Save → PATCH /api/throws/:id; Delete →
 * SlideToConfirm (mobile/athlete) or ConfirmDialog (desktop/coach) →
 * DELETE /api/throws/:id.
 *
 * Picker is rendered as a sibling Sheet on top of this one.
 */

import { useCallback, useEffect, useState } from "react";
import { Sheet, type SheetSide } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import { useToast } from "@/components/ui/Toast";
import { ImplementPicker } from "@/components/throws/ImplementPicker";
import type { ImplementCatalogRow } from "@/components/throws/ImplementPicker";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";

export interface EditableThrow {
  id: string;
  athleteId: string;
  /** May be null on legacy/un-backfilled rows. Server requires it for save. */
  implementId: string | null;
  implementDisplayLabel: string;
  distance: number | null;
  date: string; // ISO datetime
  isCompetition: boolean;
  isFoul: boolean;
  notes: string | null;
}

export interface EditThrowSheetProps {
  open: boolean;
  onClose: () => void;
  /** Athlete shell → "bottom"; coach shell → "right". Required. */
  side: SheetSide;
  initial: EditableThrow;
  onSaved?: (updated: { id: string; isPersonalBest: boolean }) => void;
  onDeleted?: (id: string) => void;
}

interface PatchPayload {
  success: boolean;
  data?: { id: string; isPersonalBest: boolean };
  error?: string;
}

interface DeletePayload {
  success: boolean;
  data?: { id: string };
  error?: string;
}

function toLocalDateTimeInput(iso: string): string {
  // Strip seconds + ms for HTML datetime-local input.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTimeInput(local: string): string {
  // Treat as the user's local timezone, return ISO.
  return new Date(local).toISOString();
}

export function EditThrowSheet({
  open,
  onClose,
  side,
  initial,
  onSaved,
  onDeleted,
}: EditThrowSheetProps) {
  const toast = useToast();
  const [implementId, setImplementId] = useState<string | null>(initial.implementId);
  const [implementLabel, setImplementLabel] = useState(initial.implementDisplayLabel);
  const [distanceStr, setDistanceStr] = useState<string>(
    initial.distance == null ? "" : String(initial.distance)
  );
  const [date, setDate] = useState(toLocalDateTimeInput(initial.date));
  const [isCompetition, setIsCompetition] = useState(initial.isCompetition);
  const [isFoul, setIsFoul] = useState(initial.isFoul);
  const [notes, setNotes] = useState(initial.notes ?? "");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset state when the sheet is reopened with a different throw.
  useEffect(() => {
    if (!open) return;
    setImplementId(initial.implementId);
    setImplementLabel(initial.implementDisplayLabel);
    setDistanceStr(initial.distance == null ? "" : String(initial.distance));
    setDate(toLocalDateTimeInput(initial.date));
    setIsCompetition(initial.isCompetition);
    setIsFoul(initial.isFoul);
    setNotes(initial.notes ?? "");
  }, [open, initial]);

  const handleSelectImplement = useCallback((row: ImplementCatalogRow) => {
    setImplementId(row.id);
    setImplementLabel(row.displayLabel);
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (!implementId) {
      toast.error("Pick an implement before saving.");
      return;
    }
    // Distance: empty string = null; "0" = 0 (do NOT coerce). Per CLAUDE.md §3.
    let distance: number | null;
    if (distanceStr === "") {
      distance = null;
    } else {
      const n = parseFloat(distanceStr);
      if (!Number.isFinite(n)) {
        toast.error("Distance is not a valid number.");
        return;
      }
      distance = n;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/throws/${initial.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...csrfHeaders(),
        },
        credentials: "same-origin",
        body: JSON.stringify({
          implementId,
          distance,
          performedAt: fromLocalDateTimeInput(date),
          isCompetition,
          isFoul,
          notes: notes.trim() === "" ? null : notes.trim(),
        }),
      });
      const payload = (await res.json()) as PatchPayload;
      if (!res.ok || !payload.success || !payload.data) {
        toast.error(payload.error ?? `Save failed (${res.status})`);
        return;
      }
      toast.success("Throw saved");
      onSaved?.(payload.data);
      onClose();
    } catch (err) {
      logger.error("EditThrowSheet save failed", {
        context: "components/throws/EditThrowSheet",
        error: err,
      });
      toast.error(err instanceof Error ? err.message : "Network error — please try again");
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    implementId,
    distanceStr,
    date,
    isCompetition,
    isFoul,
    notes,
    initial.id,
    onSaved,
    onClose,
    toast,
  ]);

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/throws/${initial.id}`, {
        method: "DELETE",
        headers: csrfHeaders(),
        credentials: "same-origin",
      });
      const payload = (await res.json()) as DeletePayload;
      if (!res.ok || !payload.success) {
        toast.error(payload.error ?? `Delete failed (${res.status})`);
        return;
      }
      toast.success("Throw deleted");
      onDeleted?.(initial.id);
      onClose();
    } catch (err) {
      logger.error("EditThrowSheet delete failed", {
        context: "components/throws/EditThrowSheet",
        error: err,
      });
      toast.error(err instanceof Error ? err.message : "Network error — please try again");
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  }, [deleting, initial.id, onDeleted, onClose, toast]);

  const isBottom = side === "bottom";

  return (
    <>
      <Sheet
        open={open && !pickerOpen}
        onClose={onClose}
        side={side}
        size={isBottom ? "lg" : "md"}
        title="Edit throw"
        ariaLabel="Edit throw"
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {/* Implement picker trigger */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Implement
            </label>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-full flex items-center justify-between rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 text-left hover:border-primary-500/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            >
              <span className="font-mono tabular-nums text-base font-semibold text-[var(--foreground)]">
                {implementLabel || "Choose implement…"}
              </span>
              <span className="text-sm text-primary-500">Change</span>
            </button>
          </div>

          {/* Distance */}
          <div>
            <label
              htmlFor="edit-throw-distance"
              className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5"
            >
              Distance (m)
            </label>
            <input
              id="edit-throw-distance"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={distanceStr}
              onChange={(e) => setDistanceStr(e.target.value)}
              placeholder="—"
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 font-mono tabular-nums text-base text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            />
          </div>

          {/* When */}
          <div>
            <label
              htmlFor="edit-throw-date"
              className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5"
            >
              When
            </label>
            <input
              id="edit-throw-date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 text-base text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            />
          </div>

          {/* Competition + Foul toggles */}
          <div className="flex items-center gap-3">
            <ToggleChip
              label="Competition"
              active={isCompetition}
              onClick={() => setIsCompetition((v) => !v)}
            />
            <ToggleChip label="Foul" active={isFoul} onClick={() => setIsFoul((v) => !v)} />
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="edit-throw-notes"
              className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5"
            >
              Notes
            </label>
            <textarea
              id="edit-throw-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional"
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 resize-none"
            />
          </div>

          {/* Delete trigger — variant by shell */}
          <div className="pt-2 border-t border-[var(--card-border)]/40">
            {isBottom ? (
              <SlideToConfirm
                label="Slide to delete throw"
                variant="destructive"
                onConfirm={() => void handleDelete()}
                disabled={deleting}
              />
            ) : (
              <Button
                variant="danger"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={deleting}
              >
                Delete throw
              </Button>
            )}
          </div>
        </div>
      </Sheet>

      <ImplementPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        athleteId={initial.athleteId}
        side={side}
        onSelect={handleSelectImplement}
        selectedId={implementId}
        title="Change implement"
      />

      {!isBottom && (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onClose={() => setConfirmDeleteOpen(false)}
          onConfirm={handleDelete}
          title="Delete this throw?"
          description="This removes the throw and recomputes the athlete's PR for this implement. Cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          loading={deleting}
        />
      )}
    </>
  );
}

/* ─── Internal pieces ───────────────────────────────────────────────────── */

interface ToggleChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function ToggleChip({ label, active, onClick }: ToggleChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-full border border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 px-3 py-1.5 text-sm font-medium transition-colors active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          : "rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] text-muted px-3 py-1.5 text-sm font-medium hover:border-primary-500/50 transition-colors active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
      }
    >
      {label}
    </button>
  );
}
