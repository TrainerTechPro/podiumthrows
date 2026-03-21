"use client";

import { useState, useEffect, useCallback } from "react";
import type { EventGroupItem } from "@/lib/data/event-groups";
import { Modal, Button, Input } from "@/components";
import { csrfHeaders } from "@/lib/csrf-client";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/* ─── Constants ────────────────────────────────────────────────────────── */

const EVENT_OPTIONS = [
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
] as const;

const PRESET_COLORS = [
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#06b6d4",
];

/* ─── Props ────────────────────────────────────────────────────────────── */

interface GroupModalProps {
  open: boolean;
  onClose: () => void;
  group?: EventGroupItem | null;
  onSaved: () => void;
}

/* ─── Component ────────────────────────────────────────────────────────── */

export function GroupModal({ open, onClose, group, onSaved }: GroupModalProps) {
  const isEdit = !!group;

  const [name, setName] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form state when modal opens or group changes
  useEffect(() => {
    if (open) {
      setName(group?.name ?? "");
      setEvents(group?.events ?? []);
      setColor(group?.color ?? PRESET_COLORS[0]);
      setDescription(group?.description ?? "");
      setError(null);
    }
  }, [open, group]);

  const toggleEvent = useCallback((value: string) => {
    setEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }
    if (events.length === 0) {
      setError("Select at least one event.");
      return;
    }

    setSaving(true);
    try {
      const payload = { name: name.trim(), events, color, description: description.trim() || null };
      const url = isEdit ? `/api/coach/event-groups/${group.id}` : "/api/coach/event-groups";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong");
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save group");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Event Group" : "Create Event Group"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {isEdit ? "Save Changes" : "Create Group"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <Input
          label="Group Name"
          placeholder="e.g. Men's Shot Put"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        {/* Events — pill buttons */}
        <div className="space-y-1.5">
          <label className="label">Events</label>
          <div className="flex flex-wrap gap-2">
            {EVENT_OPTIONS.map((opt) => {
              const isSelected = events.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleEvent(opt.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                    "border",
                    isSelected
                      ? "bg-primary-500 text-white border-primary-500"
                      : "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)] border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-500/30"
                  )}
                >
                  {isSelected && <Check size={14} strokeWidth={1.75} aria-hidden="true" />}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Color picker */}
        <div className="space-y-1.5">
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "w-8 h-8 rounded-full transition-all",
                  color === c
                    ? "ring-2 ring-offset-2 ring-[var(--foreground)] ring-offset-[var(--card-bg)] scale-110"
                    : "hover:scale-110"
                )}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor="group-description" className="label">
            Description <span className="text-muted font-normal">(optional)</span>
          </label>
          <textarea
            id="group-description"
            className="input min-h-[80px] resize-y"
            placeholder="Notes about this group..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        {/* Error */}
        {error && <p className="text-sm text-danger-500 dark:text-danger-400">{error}</p>}
      </form>
    </Modal>
  );
}
