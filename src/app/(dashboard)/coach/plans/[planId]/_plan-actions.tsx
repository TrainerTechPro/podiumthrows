"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { AthletePickerItem } from "@/lib/data/coach";

/**
 * Plan-level actions: Edit, Assign to athletes, Delete.
 *
 * Implementation note (H-2): Assign currently POSTs to /api/coach/sessions,
 * which creates TrainingSession rows linked by planId. The schema also has
 * ProgrammedSession.planId (added in H-2 migration) — that's future-proofing
 * infrastructure for H-2b, when the dual assignment systems (TrainingSession
 * vs ProgrammedSession) get reconciled.
 */
export function PlanActions({
  planId,
  planName,
  athletes,
}: {
  planId: string;
  planName: string;
  athletes: AthletePickerItem[];
}) {
  const router = useRouter();
  const { success, error } = useToast();

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedAthletes, setSelectedAthletes] = useState<Set<string>>(new Set());
  const [scheduledDate, setScheduledDate] = useState("");
  const [coachNotes, setCoachNotes] = useState("");
  const [assigning, setAssigning] = useState(false);

  function toggleAthlete(id: string) {
    setSelectedAthletes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function closeAssignModal() {
    setAssignOpen(false);
    setSelectedAthletes(new Set());
    setScheduledDate("");
    setCoachNotes("");
  }

  async function handleAssign() {
    if (selectedAthletes.size === 0) {
      error("Select at least one athlete");
      return;
    }
    if (!scheduledDate) {
      error("Pick a scheduled date");
      return;
    }

    setAssigning(true);
    try {
      const res = await fetch("/api/coach/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          planId,
          athleteIds: Array.from(selectedAthletes),
          scheduledDate,
          coachNotes: coachNotes.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        success(
          `Assigned to ${data.created} athlete${data.created === 1 ? "" : "s"}`,
          "Sessions appear on the schedule."
        );
        closeAssignModal();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        error("Assign failed", data.error ?? "Could not assign plan.");
      }
    } catch (err) {
      error("Assign failed", err instanceof Error ? err.message : "Network error");
    } finally {
      setAssigning(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/coach/plans/${planId}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      if (res.ok) {
        success("Plan deleted");
        router.push("/coach/plans");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        error("Delete failed", data.error ?? "Failed to delete plan.");
        setConfirmDeleteOpen(false);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Plan"
        description={`Delete "${planName}"? Already-scheduled sessions will remain but lose the link to this plan. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      <Modal
        open={assignOpen}
        onClose={closeAssignModal}
        title="Assign Plan to Athletes"
        description={`Schedule "${planName}" as a training session for the selected athletes.`}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={closeAssignModal} disabled={assigning}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAssign}
              loading={assigning}
              disabled={selectedAthletes.size === 0 || !scheduledDate}
            >
              Assign to {selectedAthletes.size}{" "}
              {selectedAthletes.size === 1 ? "athlete" : "athletes"}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Date */}
          <div>
            <label
              htmlFor="scheduled-date"
              className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5"
            >
              Scheduled Date
            </label>
            <input
              id="scheduled-date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </div>

          {/* Athletes */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              Athletes ({selectedAthletes.size} selected)
            </label>
            {athletes.length === 0 ? (
              <p className="text-sm text-muted py-4">
                No athletes on your roster yet.{" "}
                <Link href="/coach/athletes" className="text-primary-500 hover:underline">
                  Add athletes
                </Link>
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto custom-scrollbar border border-[var(--card-border)] rounded-lg divide-y divide-[var(--card-border)]">
                {athletes.map((a) => {
                  const checked = selectedAthletes.has(a.id);
                  return (
                    <label
                      key={a.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAthlete(a.id)}
                        className="rounded border-[var(--card-border)] text-primary-500 focus:ring-primary-500/50"
                      />
                      <Avatar name={`${a.firstName} ${a.lastName}`} src={a.avatarUrl} size="sm" />
                      <span className="text-sm font-medium">
                        {a.firstName} {a.lastName}
                      </span>
                      {a.events.length > 0 && (
                        <span className="text-xs text-muted ml-auto">{a.events.join(", ")}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="coach-notes"
              className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5"
            >
              Notes (optional)
            </label>
            <textarea
              id="coach-notes"
              value={coachNotes}
              onChange={(e) => setCoachNotes(e.target.value)}
              rows={3}
              placeholder="Coaching cues, emphasis for this assignment…"
              className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none"
            />
          </div>
        </div>
      </Modal>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="primary" onClick={() => setAssignOpen(true)}>
          Assign to athletes
        </Button>
        <Button
          variant="ghost"
          className="text-danger-600 dark:text-danger-400"
          onClick={() => setConfirmDeleteOpen(true)}
        >
          Delete
        </Button>
      </div>
    </>
  );
}
