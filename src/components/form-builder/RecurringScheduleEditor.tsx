"use client";

import { useState, useCallback } from "react";
import { localToday } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import type { RecurrenceFrequency } from "@/lib/forms/types";

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
}

interface ScheduleData {
  frequency: RecurrenceFrequency;
  specificDays: number[];
  timeOfDay: string;
  athleteIds: string[];
  assignToAll: boolean;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface RecurringScheduleEditorProps {
  questionnaireId: string;
  athletes: Athlete[];
  initialSchedule?: ScheduleData | null;
  onClose: () => void;
  onSaved: () => void;
}

const FREQUENCY_OPTIONS = [
  { value: "DAILY", label: "Daily" },
  { value: "SPECIFIC_DAYS", label: "Specific Days of Week" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every 2 Weeks" },
  { value: "MONTHLY", label: "Monthly" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RecurringScheduleEditor({
  questionnaireId,
  athletes,
  initialSchedule,
  onClose,
  onSaved,
}: RecurringScheduleEditorProps) {
  const [schedule, setSchedule] = useState<ScheduleData>(
    initialSchedule ?? {
      frequency: "DAILY",
      specificDays: [],
      timeOfDay: "08:00",
      athleteIds: [],
      assignToAll: true,
      startDate: localToday(),
      endDate: "",
      isActive: true,
    }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: number) => {
    setSchedule((prev) => ({
      ...prev,
      specificDays: prev.specificDays.includes(day)
        ? prev.specificDays.filter((d) => d !== day)
        : [...prev.specificDays, day].sort(),
    }));
  };

  const toggleAthlete = (id: string) => {
    setSchedule((prev) => ({
      ...prev,
      athleteIds: prev.athleteIds.includes(id)
        ? prev.athleteIds.filter((a) => a !== id)
        : [...prev.athleteIds, id],
    }));
  };

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);

    try {
      const res = await fetch(
        `/api/coach/questionnaires/${questionnaireId}/schedule`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...schedule,
            endDate: schedule.endDate || undefined,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save schedule");
        return;
      }

      onSaved();
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }, [questionnaireId, schedule, onSaved]);

  const handleDelete = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(
        `/api/coach/questionnaires/${questionnaireId}/schedule`,
        { method: "DELETE" }
      );
      onSaved();
    } catch {
      setError("Failed to delete schedule");
    } finally {
      setSaving(false);
    }
  }, [questionnaireId, onSaved]);

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-bold font-heading text-[var(--foreground)]">
        Recurring Schedule
      </h3>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Frequency */}
      <Select
        label="Frequency"
        options={FREQUENCY_OPTIONS}
        value={schedule.frequency}
        onChange={(v) =>
          setSchedule((prev) => ({
            ...prev,
            frequency: (v ?? "DAILY") as RecurrenceFrequency,
          }))
        }
      />

      {/* Specific days picker */}
      {schedule.frequency === "SPECIFIC_DAYS" && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--foreground)]">
            Days of Week
          </label>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                  schedule.specificDays.includes(i)
                    ? "bg-primary-500 text-white"
                    : "bg-[var(--card-bg)] border border-[var(--card-border)] text-muted hover:text-[var(--foreground)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time of day (informational) */}
      <Input
        label="Time of Day (informational)"
        type="time"
        value={schedule.timeOfDay}
        onChange={(e) =>
          setSchedule((prev) => ({ ...prev, timeOfDay: e.target.value }))
        }
      />

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Start Date"
          type="date"
          required
          value={schedule.startDate}
          onChange={(e) =>
            setSchedule((prev) => ({ ...prev, startDate: e.target.value }))
          }
        />
        <Input
          label="End Date (optional)"
          type="date"
          value={schedule.endDate}
          onChange={(e) =>
            setSchedule((prev) => ({ ...prev, endDate: e.target.value }))
          }
        />
      </div>

      {/* Athlete assignment */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--foreground)]">
          Assign To
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={schedule.assignToAll}
            onChange={(e) =>
              setSchedule((prev) => ({
                ...prev,
                assignToAll: e.target.checked,
              }))
            }
            className="w-4 h-4 rounded border-[var(--card-border)] text-primary-500 focus:ring-primary-500/30"
          />
          All athletes on my roster
        </label>

        {!schedule.assignToAll && (
          <div className="max-h-48 overflow-y-auto space-y-1 border border-[var(--card-border)] rounded-xl p-2">
            {athletes.length === 0 && (
              <p className="text-xs text-muted p-2">No athletes found</p>
            )}
            {athletes.map((athlete) => (
              <label
                key={athlete.id}
                className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5 rounded-lg hover:bg-[var(--card-bg)] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={schedule.athleteIds.includes(athlete.id)}
                  onChange={() => toggleAthlete(athlete.id)}
                  className="w-4 h-4 rounded border-[var(--card-border)] text-primary-500 focus:ring-primary-500/30"
                />
                {athlete.firstName} {athlete.lastName}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Active toggle */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={schedule.isActive}
          onChange={(e) =>
            setSchedule((prev) => ({
              ...prev,
              isActive: e.target.checked,
            }))
          }
          className="w-4 h-4 rounded border-[var(--card-border)] text-primary-500 focus:ring-primary-500/30"
        />
        Schedule is active
      </label>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {initialSchedule && (
            <Button
              variant="ghost"
              onClick={handleDelete}
              disabled={saving}
              className="text-red-500 hover:text-red-600"
            >
              Remove Schedule
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {initialSchedule ? "Update Schedule" : "Create Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
