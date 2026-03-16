"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { csrfHeaders } from "@/lib/csrf-client";

type Props = {
  open: boolean;
  onClose: () => void;
  questionnaireId: string;
  athletes: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
  assignedAthleteIds: string[];
};

export function AssignModal({
  open,
  onClose,
  questionnaireId,
  athletes,
  assignedAthleteIds,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function toggleAthlete(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleAssign() {
    if (selected.size === 0) return;
    setSaving(true);
    setResult(null);

    try {
      const res = await fetch(
        `/api/coach/questionnaires/${questionnaireId}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ athleteIds: Array.from(selected) }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setResult(
          `Assigned to ${data.assigned} athlete${data.assigned !== 1 ? "s" : ""}${
            data.skipped > 0 ? ` (${data.skipped} already assigned)` : ""
          }`
        );
        setSelected(new Set());
        // Close after short delay
        setTimeout(() => {
          setResult(null);
          onClose();
        }, 1500);
      }
    } catch {
      setResult("Failed to assign");
    } finally {
      setSaving(false);
    }
  }

  const alreadyAssigned = new Set(assignedAthleteIds);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign to Athletes"
      size="sm"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-muted">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              loading={saving}
              disabled={selected.size === 0}
            >
              Assign
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {result && (
          <div className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-600 dark:text-green-400">
            {result}
          </div>
        )}

        {athletes.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">
            No athletes on your roster.
          </p>
        ) : (
          athletes.map((a) => {
            const isAssigned = alreadyAssigned.has(a.id);
            const isSelected = selected.has(a.id);

            return (
              <label
                key={a.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  isAssigned
                    ? "opacity-50 cursor-not-allowed"
                    : isSelected
                    ? "bg-primary-500/10 ring-1 ring-primary-500/20"
                    : "hover:bg-surface-100 dark:hover:bg-surface-800"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isAssigned || isSelected}
                  disabled={isAssigned}
                  onChange={() => !isAssigned && toggleAthlete(a.id)}
                  className="w-4 h-4 rounded border-[var(--card-border)] text-primary-500 focus:ring-primary-500/30"
                />
                <span className="text-sm text-[var(--foreground)]">
                  {a.firstName} {a.lastName}
                </span>
                {isAssigned && (
                  <span className="text-[10px] text-muted ml-auto">
                    Already assigned
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>
    </Modal>
  );
}
