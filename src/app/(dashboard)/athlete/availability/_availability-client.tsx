"use client";

import { useState, useCallback } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  CalendarClock,
  CopyCheck,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type {
  AvailabilityBlock,
  AvailabilityOverrideItem,
} from "@/lib/data/availability";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Format a Date as a YYYY-MM-DD string in the browser's local timezone.
 * Uses getFullYear/getMonth/getDate (local, not UTC) so it's safe in client
 * components where we want the user's wall-clock date, not the Vercel UTC date.
 */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type AvailType = "AVAILABLE" | "UNAVAILABLE" | "CONDITIONAL";
type OverrideType = "AVAILABLE" | "UNAVAILABLE";

function formatTime(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDate(dateStr: string): string {
  // dateStr is "YYYY-MM-DD"
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Generate 30-min increments from 06:00 to 22:00 */
function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break;
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      options.push({ value, label: formatTime(value) });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

/** Group blocks that have the same startTime + endTime + type + label into logical rows */
type BlockGroup = {
  key: string;
  dayOfWeeks: number[];
  ids: string[];
  startTime: string;
  endTime: string;
  type: AvailType;
  label: string | null;
  notes: string | null;
};

function groupBlocks(blocks: AvailabilityBlock[]): BlockGroup[] {
  const map = new Map<string, BlockGroup>();

  for (const b of blocks) {
    const key = `${b.startTime}|${b.endTime}|${b.type}|${b.label ?? ""}|${b.notes ?? ""}`;
    if (map.has(key)) {
      const g = map.get(key)!;
      g.dayOfWeeks.push(b.dayOfWeek);
      g.ids.push(b.id);
    } else {
      map.set(key, {
        key,
        dayOfWeeks: [b.dayOfWeek],
        ids: [b.id],
        startTime: b.startTime,
        endTime: b.endTime,
        type: b.type,
        label: b.label,
        notes: b.notes,
      });
    }
  }

  // Sort each group's days
  for (const g of map.values()) {
    g.dayOfWeeks.sort((a, b) => a - b);
  }

  return Array.from(map.values());
}

function typeColor(type: AvailType | OverrideType): string {
  if (type === "AVAILABLE") return "border-green-500";
  if (type === "UNAVAILABLE") return "border-red-500";
  return "border-amber-500";
}

function typeBadgeVariant(
  type: AvailType | OverrideType
): "success" | "danger" | "warning" {
  if (type === "AVAILABLE") return "success";
  if (type === "UNAVAILABLE") return "danger";
  return "warning";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AvailabilityClientProps {
  initialData: {
    blocks: AvailabilityBlock[];
    overrides: AvailabilityOverrideItem[];
  };
}

// ─── Block Form ───────────────────────────────────────────────────────────────

interface BlockFormState {
  days: number[];
  startTime: string;
  endTime: string;
  type: AvailType;
  label: string;
  notes: string;
}

const DEFAULT_BLOCK_FORM: BlockFormState = {
  days: [],
  startTime: "09:00",
  endTime: "12:00",
  type: "AVAILABLE",
  label: "",
  notes: "",
};

// ─── Override Form ────────────────────────────────────────────────────────────

interface OverrideFormState {
  date: string;
  startTime: string;
  endTime: string;
  type: OverrideType;
  reason: string;
  allDay: boolean;
}

const DEFAULT_OVERRIDE_FORM: OverrideFormState = {
  date: "",
  startTime: "",
  endTime: "",
  type: "UNAVAILABLE",
  reason: "",
  allDay: true,
};

// ─── Day Toggle Pill ──────────────────────────────────────────────────────────

function DayPill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-10 h-10 rounded-full text-xs font-semibold transition-all duration-150",
        "border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60",
        selected
          ? "bg-primary-500 text-white border-primary-500 shadow-sm"
          : "bg-[var(--card-bg)] text-[var(--muted)] border-[var(--card-border)] hover:border-primary-500/50 hover:text-primary-500",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

// ─── Type Toggle Pill ─────────────────────────────────────────────────────────

function TypePill({
  label,
  value,
  current,
  colorClass,
  onClick,
}: {
  label: string;
  value: string;
  current: string;
  colorClass: string;
  onClick: () => void;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60",
        active
          ? `${colorClass} border-transparent`
          : "bg-[var(--card-bg)] text-[var(--muted)] border-[var(--card-border)] hover:border-surface-400",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AvailabilityClient({ initialData }: AvailabilityClientProps) {
  const { success, error } = useToast();

  const [blocks, setBlocks] = useState<AvailabilityBlock[]>(initialData.blocks);
  const [overrides, setOverrides] = useState<AvailabilityOverrideItem[]>(
    initialData.overrides
  );

  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockForm, setBlockForm] = useState<BlockFormState>(DEFAULT_BLOCK_FORM);
  const [blockSaving, setBlockSaving] = useState(false);

  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideForm, setOverrideForm] =
    useState<OverrideFormState>(DEFAULT_OVERRIDE_FORM);
  const [overrideSaving, setOverrideSaving] = useState(false);

  // Edit state: which group is being edited (by group key)
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<BlockFormState>(DEFAULT_BLOCK_FORM);
  const [editSaving, setEditSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copyingWeek, setCopyingWeek] = useState(false);
  const [sharingLink, setSharingLink] = useState(false);

  // ─── Refresh from server ────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    const res = await fetch("/api/athlete/availability");
    if (res.ok) {
      const json = await res.json();
      setBlocks(json.data.blocks);
      setOverrides(json.data.overrides);
    }
  }, []);

  // ─── Block CRUD ─────────────────────────────────────────────────────────

  const saveBlock = async () => {
    if (blockForm.days.length === 0) {
      error("Select at least one day", "Choose which days this block applies to.");
      return;
    }
    if (!blockForm.startTime || !blockForm.endTime) {
      error("Missing time range", "Please set a start and end time.");
      return;
    }
    if (blockForm.startTime >= blockForm.endTime) {
      error("Invalid time range", "Start time must be before end time.");
      return;
    }

    setBlockSaving(true);
    try {
      // Create one block per selected day
      const results = await Promise.all(
        blockForm.days.map((day) =>
          fetch("/api/athlete/availability", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({
              dayOfWeek: day,
              startTime: blockForm.startTime,
              endTime: blockForm.endTime,
              type: blockForm.type,
              label: blockForm.label.trim() || null,
              notes:
                blockForm.type === "CONDITIONAL"
                  ? blockForm.notes.trim() || null
                  : null,
            }),
          })
        )
      );

      const hasError = results.some((r) => !r.ok);
      if (hasError) {
        error("Failed to save", "One or more blocks could not be created.");
      } else {
        success(
          "Availability saved",
          `Added ${blockForm.days.length} day${blockForm.days.length > 1 ? "s" : ""}.`
        );
        setBlockForm(DEFAULT_BLOCK_FORM);
        setShowBlockForm(false);
        await refresh();
      }
    } catch {
      error("Network error", "Please try again.");
    } finally {
      setBlockSaving(false);
    }
  };

  const deleteGroup = async (group: BlockGroup) => {
    setDeletingId(group.key);
    try {
      const results = await Promise.all(
        group.ids.map((id) =>
          fetch(`/api/athlete/availability/${id}`, {
            method: "DELETE",
            headers: csrfHeaders(),
          })
        )
      );
      const hasError = results.some((r) => !r.ok);
      if (hasError) {
        error("Delete failed", "Could not remove one or more blocks.");
      } else {
        success("Block removed", "Availability block deleted.");
        await refresh();
      }
    } catch {
      error("Network error", "Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (group: BlockGroup) => {
    setEditingGroupKey(group.key);
    setEditForm({
      days: [...group.dayOfWeeks],
      startTime: group.startTime,
      endTime: group.endTime,
      type: group.type,
      label: group.label ?? "",
      notes: group.notes ?? "",
    });
  };

  const saveEdit = async (group: BlockGroup) => {
    if (editForm.days.length === 0) {
      error("Select at least one day", "Choose which days this block applies to.");
      return;
    }
    if (editForm.startTime >= editForm.endTime) {
      error("Invalid time range", "Start time must be before end time.");
      return;
    }

    setEditSaving(true);
    try {
      // Delete all old blocks in this group, then create new ones
      await Promise.all(
        group.ids.map((id) =>
          fetch(`/api/athlete/availability/${id}`, {
            method: "DELETE",
            headers: csrfHeaders(),
          })
        )
      );

      const results = await Promise.all(
        editForm.days.map((day) =>
          fetch("/api/athlete/availability", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({
              dayOfWeek: day,
              startTime: editForm.startTime,
              endTime: editForm.endTime,
              type: editForm.type,
              label: editForm.label.trim() || null,
              notes:
                editForm.type === "CONDITIONAL"
                  ? editForm.notes.trim() || null
                  : null,
            }),
          })
        )
      );

      const hasError = results.some((r) => !r.ok);
      if (hasError) {
        error("Update failed", "Could not save changes.");
      } else {
        success("Block updated", "Changes saved.");
        setEditingGroupKey(null);
        await refresh();
      }
    } catch {
      error("Network error", "Please try again.");
    } finally {
      setEditSaving(false);
    }
  };

  // ─── Override CRUD ───────────────────────────────────────────────────────

  const saveOverride = async () => {
    if (!overrideForm.date) {
      error("Date required", "Please select a date for the change.");
      return;
    }
    if (
      !overrideForm.allDay &&
      overrideForm.startTime &&
      overrideForm.endTime &&
      overrideForm.startTime >= overrideForm.endTime
    ) {
      error("Invalid time range", "Start time must be before end time.");
      return;
    }

    setOverrideSaving(true);
    try {
      const res = await fetch("/api/athlete/availability/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          date: overrideForm.date,
          startTime:
            overrideForm.allDay || !overrideForm.startTime
              ? null
              : overrideForm.startTime,
          endTime:
            overrideForm.allDay || !overrideForm.endTime
              ? null
              : overrideForm.endTime,
          type: overrideForm.type,
          reason: overrideForm.reason.trim() || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        error("Could not save", (json as { error?: string }).error ?? "Please try again.");
      } else {
        success("Temporary change added", formatDate(overrideForm.date));
        setOverrideForm(DEFAULT_OVERRIDE_FORM);
        setShowOverrideForm(false);
        await refresh();
      }
    } catch {
      error("Network error", "Please try again.");
    } finally {
      setOverrideSaving(false);
    }
  };

  const deleteOverride = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/athlete/availability/overrides/${id}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      if (!res.ok) {
        error("Delete failed", "Could not remove the override.");
      } else {
        success("Change removed");
        await refresh();
      }
    } catch {
      error("Network error", "Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Copy this week's overrides to next week ─────────────────────────────

  const copyWeekOverrides = async () => {
    // Count overrides in the current Mon–Sun window for the confirm message
    const now = new Date();
    const todayDow = now.getDay();
    const daysToMon = todayDow === 0 ? 6 : todayDow - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysToMon);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekStart = localDateStr(monday);
    const weekEnd = localDateStr(sunday);
    const thisWeekCount = overrides.filter(
      (o) => o.date >= weekStart && o.date <= weekEnd
    ).length;

    if (thisWeekCount === 0) return;

    const confirmed = window.confirm(
      `This will copy ${thisWeekCount} change${thisWeekCount > 1 ? "s" : ""} from this week to next week. Continue?`
    );
    if (!confirmed) return;

    setCopyingWeek(true);
    try {
      const res = await fetch(
        "/api/athlete/availability/overrides/copy-week",
        { method: "POST", headers: csrfHeaders() }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        error("Copy failed", (json as { error?: string }).error ?? "Please try again.");
      } else {
        const created = (json as { created?: number }).created ?? 0;
        if (created === 0) {
          success("Already up to date", "Next week already has those overrides.");
        } else {
          success(
            `${created} override${created > 1 ? "s" : ""} copied`,
            "Next week's schedule updated."
          );
          await refresh();
        }
      }
    } catch {
      error("Network error", "Please try again.");
    } finally {
      setCopyingWeek(false);
    }
  };

  // ─── Share read-only link ─────────────────────────────────────────────────

  const shareLink = async () => {
    setSharingLink(true);
    try {
      const res = await fetch("/api/athlete/availability/share", {
        method: "POST",
        headers: csrfHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        error("Could not generate link", (json as { error?: string }).error ?? "Please try again.");
      } else {
        const shareUrl = (json as { shareUrl?: string }).shareUrl ?? "";
        await navigator.clipboard.writeText(shareUrl);
        success(
          "Share link copied",
          "Anyone with this link can view your availability."
        );
      }
    } catch {
      error("Network error", "Please try again.");
    } finally {
      setSharingLink(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const groups = groupBlocks(blocks);

  // Compute how many overrides fall in the current Mon–Sun week
  const thisWeekOverrideCount = (() => {
    const now = new Date();
    const todayDow = now.getDay();
    const daysToMon = todayDow === 0 ? 6 : todayDow - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysToMon);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekStart = localDateStr(monday);
    const weekEnd = localDateStr(sunday);
    return overrides.filter((o) => o.date >= weekStart && o.date <= weekEnd).length;
  })();

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <ScrollProgressBar />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            My Availability
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Set your weekly schedule so your coach can plan sessions around you.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          loading={sharingLink}
          onClick={shareLink}
          leftIcon={<Link2 size={14} strokeWidth={1.75} aria-hidden="true" />}
        >
          Share
        </Button>
      </div>

      {/* ── Section 1: Upcoming Changes (Overrides) ──────────────────────── */}
      {overrides.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Upcoming Changes
            </h2>
            {thisWeekOverrideCount > 0 && (
              <button
                type="button"
                onClick={copyWeekOverrides}
                disabled={copyingWeek}
                className="flex items-center gap-1.5 text-xs text-primary-500 hover:text-primary-400 disabled:opacity-50 transition-colors"
              >
                <CopyCheck size={13} strokeWidth={1.75} aria-hidden="true" />
                {copyingWeek ? "Copying…" : "Copy this week's changes →"}
              </button>
            )}
          </div>
          <StaggeredList className="space-y-2">
            {overrides.map((o) => (
              <div
                key={o.id}
                className={`card border-l-4 ${typeColor(o.type)} px-4 py-3 flex items-start gap-3`}
              >
                <CalendarClock
                  size={16}
                  strokeWidth={1.75}
                  className="text-muted mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {formatDate(o.date)}
                    </span>
                    <Badge variant={typeBadgeVariant(o.type)} dot>
                      {o.type === "AVAILABLE" ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                  {(o.startTime && o.endTime) ? (
                    <p className="text-xs font-mono tabular-nums text-muted mt-0.5">
                      {formatTime(o.startTime)} – {formatTime(o.endTime)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted mt-0.5">All Day</p>
                  )}
                  {o.reason && (
                    <p className="text-xs text-muted mt-1 italic">{o.reason}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => deleteOverride(o.id)}
                  disabled={deletingId === o.id}
                  className="shrink-0 text-surface-400 hover:text-danger-500 transition-colors disabled:opacity-50"
                  aria-label="Remove change"
                >
                  <Trash2
                    size={15}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </button>
              </div>
            ))}
          </StaggeredList>
        </section>
      )}

      {/* Add Temporary Change */}
      <section className="space-y-3">
        {overrides.length === 0 && (
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Upcoming Changes
            </h2>
          </div>
        )}

        {!showOverrideForm ? (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus size={15} strokeWidth={1.75} aria-hidden="true" />}
            onClick={() => setShowOverrideForm(true)}
          >
            Add Temporary Change
          </Button>
        ) : (
          <OverrideForm
            form={overrideForm}
            onChange={setOverrideForm}
            onSave={saveOverride}
            onCancel={() => {
              setOverrideForm(DEFAULT_OVERRIDE_FORM);
              setShowOverrideForm(false);
            }}
            saving={overrideSaving}
          />
        )}
      </section>

      {/* ── Section 2: Weekly Schedule (Recurring Blocks) ────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Weekly Schedule
          </h2>
          {!showBlockForm && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={15} strokeWidth={1.75} aria-hidden="true" />}
              onClick={() => {
                setEditingGroupKey(null);
                setShowBlockForm(true);
              }}
            >
              Add Time Block
            </Button>
          )}
        </div>

        {groups.length === 0 && !showBlockForm && (
          <EmptyState
            compact
            icon={<Clock size={22} strokeWidth={1.5} aria-hidden="true" />}
            title="No availability set"
            description="Add time blocks to tell your coach when you're free each week."
          />
        )}

        {groups.length > 0 && (
          <StaggeredList className="space-y-2">
            {groups.map((g) =>
              editingGroupKey === g.key ? (
                <div key={g.key} className="card px-4 py-4">
                  <BlockFormFields
                    form={editForm}
                    onChange={setEditForm}
                  />
                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      variant="primary"
                      size="sm"
                      loading={editSaving}
                      onClick={() => saveEdit(g)}
                      leftIcon={<Check size={14} strokeWidth={2} aria-hidden="true" />}
                    >
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingGroupKey(null)}
                      leftIcon={<X size={14} strokeWidth={2} aria-hidden="true" />}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <BlockGroupCard
                  key={g.key}
                  group={g}
                  deleting={deletingId === g.key}
                  onEdit={() => startEdit(g)}
                  onDelete={() => deleteGroup(g)}
                />
              )
            )}
          </StaggeredList>
        )}

        {/* Add block inline form */}
        {showBlockForm && (
          <div className="card px-4 py-4 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              New Time Block
            </h3>
            <BlockFormFields form={blockForm} onChange={setBlockForm} />
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={blockSaving}
                onClick={saveBlock}
                leftIcon={<Check size={14} strokeWidth={2} aria-hidden="true" />}
              >
                Save Block
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBlockForm(DEFAULT_BLOCK_FORM);
                  setShowBlockForm(false);
                }}
                leftIcon={<X size={14} strokeWidth={2} aria-hidden="true" />}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Block Group Card ─────────────────────────────────────────────────────────

function BlockGroupCard({
  group,
  deleting,
  onEdit,
  onDelete,
}: {
  group: BlockGroup;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dayStr = group.dayOfWeeks.map((d) => DAY_LABELS[d]).join(", ");

  return (
    <div
      className={`card border-l-4 ${typeColor(group.type)} px-4 py-3 flex items-start gap-3`}
    >
      <Calendar
        size={16}
        strokeWidth={1.75}
        className="text-muted mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {dayStr}
          </span>
          <Badge variant={typeBadgeVariant(group.type)}>
            {group.type === "AVAILABLE"
              ? "Available"
              : group.type === "UNAVAILABLE"
              ? "Unavailable"
              : "Conditional"}
          </Badge>
          {group.label && (
            <span className="text-xs text-muted bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full border border-[var(--card-border)]">
              {group.label}
            </span>
          )}
        </div>
        <p className="text-xs font-mono tabular-nums text-muted mt-0.5">
          {formatTime(group.startTime)} – {formatTime(group.endTime)}
        </p>
        {group.type === "CONDITIONAL" && group.notes && (
          <p className="text-xs text-muted mt-1 italic">{group.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="text-surface-400 hover:text-primary-500 transition-colors p-1 rounded"
          aria-label="Edit block"
        >
          <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="text-surface-400 hover:text-danger-500 transition-colors p-1 rounded disabled:opacity-50"
          aria-label="Delete block"
        >
          <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ─── Block Form Fields (shared between Add and Edit) ──────────────────────────

function BlockFormFields({
  form,
  onChange,
}: {
  form: BlockFormState;
  onChange: (f: BlockFormState) => void;
}) {
  const toggleDay = (day: number) => {
    onChange({
      ...form,
      days: form.days.includes(day)
        ? form.days.filter((d) => d !== day)
        : [...form.days, day],
    });
  };

  return (
    <div className="space-y-4">
      {/* Day selection */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
          Days
        </p>
        <div className="flex gap-2 flex-wrap">
          {DAY_LABELS.map((label, i) => (
            <DayPill
              key={label}
              label={label}
              selected={form.days.includes(i)}
              onClick={() => toggleDay(i)}
            />
          ))}
        </div>
      </div>

      {/* Time range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label mb-1.5 block">Start Time</label>
          <select
            value={form.startTime}
            onChange={(e) => onChange({ ...form, startTime: e.target.value })}
            className="input w-full font-mono text-sm"
          >
            {TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label mb-1.5 block">End Time</label>
          <select
            value={form.endTime}
            onChange={(e) => onChange({ ...form, endTime: e.target.value })}
            className="input w-full font-mono text-sm"
          >
            {TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Type */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
          Type
        </p>
        <div className="flex gap-2 flex-wrap">
          <TypePill
            label="Available"
            value="AVAILABLE"
            current={form.type}
            colorClass="bg-green-500/15 text-green-600 dark:text-green-400"
            onClick={() => onChange({ ...form, type: "AVAILABLE" })}
          />
          <TypePill
            label="Unavailable"
            value="UNAVAILABLE"
            current={form.type}
            colorClass="bg-red-500/15 text-red-600 dark:text-red-400"
            onClick={() => onChange({ ...form, type: "UNAVAILABLE" })}
          />
          <TypePill
            label="Conditional"
            value="CONDITIONAL"
            current={form.type}
            colorClass="bg-amber-500/15 text-amber-600 dark:text-amber-400"
            onClick={() => onChange({ ...form, type: "CONDITIONAL" })}
          />
        </div>
      </div>

      {/* Label */}
      <Input
        label="Label (optional)"
        placeholder="e.g. Class, Work, Practice"
        value={form.label}
        onChange={(e) => onChange({ ...form, label: e.target.value })}
      />

      {/* Notes — only shown for CONDITIONAL */}
      {form.type === "CONDITIONAL" && (
        <Input
          label="Conditions / Notes"
          placeholder="e.g. Available only if session is under 90 min"
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
        />
      )}
    </div>
  );
}

// ─── Override Form ────────────────────────────────────────────────────────────

function OverrideForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  form: OverrideFormState;
  onChange: (f: OverrideFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="card px-4 py-4 space-y-4">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">
        Add Temporary Change
      </h3>
      <p className="text-xs text-muted">
        Override your weekly schedule for a specific date.
      </p>

      {/* Date */}
      <div>
        <label className="label mb-1.5 block">Date</label>
        <input
          type="date"
          value={form.date}
          min={localDateStr(new Date())}
          onChange={(e) => onChange({ ...form, date: e.target.value })}
          className="input w-full"
        />
      </div>

      {/* Type */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
          Type
        </p>
        <div className="flex gap-2 flex-wrap">
          <TypePill
            label="Available"
            value="AVAILABLE"
            current={form.type}
            colorClass="bg-green-500/15 text-green-600 dark:text-green-400"
            onClick={() => onChange({ ...form, type: "AVAILABLE" })}
          />
          <TypePill
            label="Unavailable"
            value="UNAVAILABLE"
            current={form.type}
            colorClass="bg-red-500/15 text-red-600 dark:text-red-400"
            onClick={() => onChange({ ...form, type: "UNAVAILABLE" })}
          />
        </div>
      </div>

      {/* All day toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={form.allDay}
          onClick={() => onChange({ ...form, allDay: !form.allDay })}
          className={[
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60",
            form.allDay
              ? "bg-primary-500"
              : "bg-surface-300 dark:bg-surface-600",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
              form.allDay ? "translate-x-6" : "translate-x-1",
            ].join(" ")}
          />
        </button>
        <span className="text-sm text-[var(--foreground)]">All day</span>
      </div>

      {/* Time range (only when not all-day) */}
      {!form.allDay && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label mb-1.5 block">Start Time</label>
            <select
              value={form.startTime}
              onChange={(e) => onChange({ ...form, startTime: e.target.value })}
              className="input w-full font-mono text-sm"
            >
              <option value="">—</option>
              {TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-1.5 block">End Time</label>
            <select
              value={form.endTime}
              onChange={(e) => onChange({ ...form, endTime: e.target.value })}
              className="input w-full font-mono text-sm"
            >
              <option value="">—</option>
              {TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Reason */}
      <Input
        label="Reason (optional)"
        placeholder="e.g. Out of town, Doctor appointment"
        value={form.reason}
        onChange={(e) => onChange({ ...form, reason: e.target.value })}
      />

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          loading={saving}
          onClick={onSave}
          leftIcon={<Check size={14} strokeWidth={2} aria-hidden="true" />}
        >
          Save Change
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          leftIcon={<X size={14} strokeWidth={2} aria-hidden="true" />}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
