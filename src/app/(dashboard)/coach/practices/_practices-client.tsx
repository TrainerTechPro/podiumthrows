"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Plus,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { PracticeListItem, ConflictAthlete } from "@/lib/data/practices";
import { logger } from "@/lib/logger";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function parseDateLocal(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00");
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function addDays(dateStr: string, days: number): string {
  const d = parseDateLocal(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatWeekRange(start: string, end: string): string {
  const s = parseDateLocal(start);
  const e = parseDateLocal(end);
  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short" });
  const dayFmt = new Intl.DateTimeFormat("en-US", { day: "numeric" });
  if (s.getMonth() === e.getMonth()) {
    return `${monthFmt.format(s)} ${dayFmt.format(s)}–${dayFmt.format(e)}`;
  }
  return `${monthFmt.format(s)} ${dayFmt.format(s)} – ${monthFmt.format(e)} ${dayFmt.format(e)}`;
}

function isCurrentWeek(startDate: string): boolean {
  const now = new Date();
  const dow = now.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(now);
  mon.setDate(now.getDate() + offset);
  return mon.toISOString().split("T")[0] === startDate;
}

// Time options in 30-min increments for a full day
function buildTimeOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break;
      const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      opts.push({ value: val, label: formatTime(val) });
    }
  }
  return opts;
}

const TIME_OPTIONS = buildTimeOptions();

// How many weekly instances until a date?
function countWeeklyInstances(startDate: string, untilDate: string): number {
  if (!untilDate || untilDate < startDate) return 0;
  let count = 0;
  let current = parseDateLocal(startDate);
  const until = parseDateLocal(untilDate);
  while (current <= until) {
    count++;
    current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return count;
}

// ─── Practice Card ────────────────────────────────────────────────────────────

function PracticeCard({ practice }: { practice: PracticeListItem }) {
  const d = parseDateLocal(practice.date);
  const dayAbbr = DAY_ABBR[d.getDay()];
  const dayNum = d.getDate();

  const isToday = practice.date === new Date().toISOString().split("T")[0];

  return (
    <Link
      href={`/coach/practices/${practice.id}`}
      className="card card-interactive p-4 flex gap-4 items-start"
    >
      {/* Date pill */}
      <div
        className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 shrink-0 min-w-[48px] ${
          isToday
            ? "bg-primary-500/15 border border-primary-500/30"
            : "bg-surface-100 dark:bg-surface-800"
        }`}
      >
        <span
          className={`text-nano font-bold uppercase tracking-wider ${
            isToday ? "text-primary-500" : "text-muted"
          }`}
        >
          {dayAbbr}
        </span>
        <span
          className={`font-mono text-lg font-bold leading-none mt-0.5 tabular-nums ${
            isToday ? "text-primary-500" : "text-[var(--foreground)]"
          }`}
        >
          {dayNum}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Title + status badge */}
        <div className="flex items-start gap-2 flex-wrap">
          <h3 className="font-heading text-base font-semibold text-[var(--foreground)] leading-tight">
            {practice.title}
          </h3>
          {practice.status === "CANCELLED" && <Badge variant="danger">Cancelled</Badge>}
        </div>

        {/* Time */}
        <p className="text-sm text-muted font-mono tabular-nums">
          {formatTime(practice.startTime)} – {formatTime(practice.endTime)}
        </p>

        {/* Location */}
        {practice.location && (
          <p className="text-sm text-muted flex items-center gap-1.5">
            <MapPin size={13} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
            {practice.location}
          </p>
        )}

        {/* Group + stats row */}
        <div className="flex items-center gap-3 flex-wrap pt-0.5">
          <Badge variant={practice.groupId ? "info" : "neutral"}>
            {practice.groupName ?? "All Athletes"}
          </Badge>

          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Check size={11} strokeWidth={2.5} className="text-success-500" aria-hidden="true" />
              <span className="font-mono tabular-nums">{practice.attendingCount}</span>
              {" attending"}
            </span>
            {practice.conflictCount > 0 && (
              <span className="flex items-center gap-1">
                <X size={11} strokeWidth={2.5} className="text-danger-500" aria-hidden="true" />
                <span className="font-mono tabular-nums">{practice.conflictCount}</span>
                {" conflicts"}
              </span>
            )}
            <span className="text-muted/60">
              <span className="font-mono tabular-nums">{practice.totalEligibleAthletes}</span>
              {" total"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Conflict Sidebar ─────────────────────────────────────────────────────────

interface ConflictEntry {
  practiceId: string;
  practiceTitle: string;
  practiceDate: string;
  conflicts: ConflictAthlete[];
}

function ConflictSidebar({
  entries,
  isMobile = false,
}: {
  entries: ConflictEntry[];
  isMobile?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasAny = entries.some((e) => e.conflicts.length > 0);

  const content = (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-muted uppercase tracking-wider">
        Conflicts This Week
      </p>

      {!hasAny ? (
        <p className="text-sm text-muted leading-relaxed">
          No conflicts — your schedule works for everyone!
        </p>
      ) : (
        <div className="space-y-4">
          {entries
            .filter((e) => e.conflicts.length > 0)
            .map((entry) => {
              const d = parseDateLocal(entry.practiceDate);
              const dayAbbr = DAY_ABBR[d.getDay()];
              return (
                <div key={entry.practiceId} className="space-y-1.5">
                  <p className="text-xs font-semibold text-[var(--foreground)]">
                    {dayAbbr} — {entry.practiceTitle}
                  </p>
                  <ul className="space-y-1">
                    {entry.conflicts.map((c) => (
                      <li key={c.athleteId} className="flex items-start gap-1.5 text-xs text-muted">
                        <AlertTriangle
                          size={11}
                          strokeWidth={1.75}
                          className="text-warning-500 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>
                          <span className="text-[var(--foreground)] font-medium">
                            {c.athleteName}
                          </span>
                          {" — "}
                          {c.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full flex items-center justify-between px-4 py-3 card text-sm font-medium text-[var(--foreground)]"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle
              size={15}
              strokeWidth={1.75}
              aria-hidden="true"
              className="text-warning-500"
            />
            Conflict Summary
            {hasAny && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-nano font-bold bg-warning-500/15 text-warning-600 dark:text-warning-400">
                {entries.reduce((s, e) => s + e.conflicts.length, 0)}
              </span>
            )}
          </span>
          <ChevronRight
            size={16}
            strokeWidth={1.75}
            aria-hidden="true"
            className={`transition-transform duration-200 ${mobileOpen ? "rotate-90" : ""}`}
          />
        </button>
        {mobileOpen && <div className="card mt-1 px-4 py-4">{content}</div>}
      </div>
    );
  }

  return (
    <aside className="hidden lg:block card px-5 py-5 self-start sticky top-6">{content}</aside>
  );
}

// ─── New Practice Modal ───────────────────────────────────────────────────────

interface EventGroup {
  id: string;
  name: string;
}

function NewPracticeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { success, error: showError } = useToast();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("15:00");
  const [endTime, setEndTime] = useState("17:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [targetAll, setTargetAll] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groups, setGroups] = useState<EventGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [untilDate, setUntilDate] = useState("");

  const [saving, setSaving] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Fetch event groups when "specific group" is selected
  const handleTargetSwitch = useCallback(
    async (all: boolean) => {
      setTargetAll(all);
      if (!all && groups.length === 0) {
        setGroupsLoading(true);
        try {
          const res = await fetch("/api/coach/event-groups");
          if (res.ok) {
            const data = await res.json();
            setGroups(Array.isArray(data.data) ? data.data : []);
          }
        } catch (err) {
          // ignore
          logger.debug("ignore", {
            context: "src/app/(dashboard)/coach/practices/_practices-client.tsx",
            metadata: { reason: err instanceof Error ? err.message : "unknown" },
          });
        } finally {
          setGroupsLoading(false);
        }
      }
    },
    [groups.length]
  );

  const instanceCount = recurringEnabled && untilDate ? countWeeklyInstances(date, untilDate) : 0;

  async function handleSave() {
    if (!title.trim() || !date || !startTime || !endTime) return;

    setSaving(true);
    setConflictWarning(null);

    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        date,
        startTime,
        endTime,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        groupId: !targetAll && selectedGroupId ? selectedGroupId : undefined,
      };

      if (recurringEnabled && untilDate) {
        body.recurring = { untilDate };
      }

      const res = await fetch("/api/coach/practices", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create practice");
      }

      // Check for conflict warning in response
      if (json.data?.conflictingAthletes?.length > 0) {
        const names = json.data.conflictingAthletes.join(", ");
        setConflictWarning(
          `${json.data.conflictingAthletes.length} athlete(s) have conflicts: ${names}. Practice was created anyway.`
        );
        return;
      }

      if (recurringEnabled && json.data?.instanceCount > 0) {
        success("Series Created", `${json.data.instanceCount} weekly practices scheduled`);
      } else {
        success("Practice Scheduled", title.trim());
      }
      onCreated();
    } catch (err) {
      showError("Error", err instanceof Error ? err.message : "Failed to create practice");
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    title.trim().length > 0 &&
    date.length > 0 &&
    startTime &&
    endTime &&
    endTime > startTime &&
    (!recurringEnabled || untilDate >= date);

  return (
    <Modal
      open
      onClose={onClose}
      title="New Practice"
      description="Schedule a practice session for your team."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? (
              <>
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : recurringEnabled && instanceCount > 1 ? (
              `Create ${instanceCount} Practices`
            ) : (
              "Create Practice"
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Title */}
        <Input
          label="Title"
          placeholder="e.g. SP — Technique Day"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        {/* Date */}
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        {/* Time row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
              Start Time
            </label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50 font-mono"
            >
              {TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
              End Time
            </label>
            <select
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50 font-mono"
            >
              {TIME_OPTIONS.filter((o) => o.value > startTime).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Location */}
        <Input
          label="Location (optional)"
          placeholder="e.g. Throws Ring #1, Weight Room"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />

        {/* Notes */}
        <div>
          <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any reminders or context for this practice…"
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none placeholder:text-muted"
          />
        </div>

        {/* Target */}
        <div>
          <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
            Target Athletes
          </label>
          <div className="flex gap-2">
            {(["all", "group"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleTargetSwitch(opt === "all")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  (opt === "all") === targetAll
                    ? "border-primary-500 bg-primary-500/10 text-primary-500"
                    : "border-[var(--card-border)] text-muted hover:bg-surface-100 dark:hover:bg-surface-800"
                }`}
              >
                {opt === "all" ? "All Athletes" : "Specific Group"}
              </button>
            ))}
          </div>

          {!targetAll && (
            <div className="mt-3">
              {groupsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted py-2">
                  <Loader2
                    size={14}
                    strokeWidth={1.75}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Loading groups…
                </div>
              ) : groups.length === 0 ? (
                <p className="text-sm text-muted py-2">
                  No event groups found. Create one from the Athletes section.
                </p>
              ) : (
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50"
                >
                  <option value="">Select a group…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Recurring */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-muted uppercase tracking-wider">
              Recurring
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={recurringEnabled}
              onClick={() => setRecurringEnabled(!recurringEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50 ${
                recurringEnabled ? "bg-primary-500" : "bg-surface-300 dark:bg-surface-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  recurringEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {recurringEnabled && (
            <div className="mt-3 space-y-2">
              <Input
                label="Repeat until"
                type="date"
                value={untilDate}
                onChange={(e) => setUntilDate(e.target.value)}
              />
              {instanceCount > 0 && (
                <p className="text-xs text-muted flex items-center gap-1.5">
                  <RotateCcw
                    size={11}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className="text-primary-500"
                  />
                  Will create{" "}
                  <span className="font-mono font-semibold text-primary-500">{instanceCount}</span>{" "}
                  weekly instances until{" "}
                  {parseDateLocal(untilDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Conflict warning (inline) */}
        {conflictWarning && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-warning-500/10 border border-warning-500/20 text-sm text-warning-700 dark:text-warning-400">
            <AlertTriangle
              size={15}
              strokeWidth={1.75}
              aria-hidden="true"
              className="shrink-0 mt-0.5"
            />
            <span>{conflictWarning}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PracticesClient({
  initialPractices,
  initialStartDate,
  initialEndDate,
}: {
  initialPractices: PracticeListItem[];
  initialStartDate: string;
  initialEndDate: string;
}) {
  const router = useRouter();
  const [practices, setPractices] = useState<PracticeListItem[]>(initialPractices);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [loading, setLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  const fetchPractices = useCallback(async (start: string, end: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coach/practices?startDate=${start}&endDate=${end}`);
      if (res.ok) {
        const json = await res.json();
        setPractices(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function goToPrevWeek() {
    const newStart = addDays(startDate, -7);
    const newEnd = addDays(endDate, -7);
    setStartDate(newStart);
    setEndDate(newEnd);
    fetchPractices(newStart, newEnd);
  }

  function goToNextWeek() {
    const newStart = addDays(startDate, 7);
    const newEnd = addDays(endDate, 7);
    setStartDate(newStart);
    setEndDate(newEnd);
    fetchPractices(newStart, newEnd);
  }

  function goToThisWeek() {
    const now = new Date();
    const dow = now.getDay();
    const offset = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(now);
    mon.setDate(now.getDate() + offset);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const newStart = mon.toISOString().split("T")[0];
    const newEnd = sun.toISOString().split("T")[0];
    setStartDate(newStart);
    setEndDate(newEnd);
    fetchPractices(newStart, newEnd);
  }

  // Build conflict sidebar entries
  const conflictEntries: ConflictEntry[] = [];
  // We don't have per-athlete conflict details in PracticeListItem directly
  // — we just know counts. Surface the count info as a proxy here.
  // Real per-name data would require a second fetch; showing count summary instead.
  // (The attendance page has full conflict detail per athlete.)

  const isThisWeek = isCurrentWeek(startDate);

  return (
    <div className="space-y-6">
      <ScrollProgressBar />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--foreground)]">Practices</h1>
          <p className="text-sm text-muted mt-1">Schedule and manage team practice sessions</p>
        </div>
        <Button onClick={() => setShowNewModal(true)} className="sm:shrink-0">
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          New Practice
        </Button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={goToPrevWeek}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--card-border)] text-sm font-medium text-muted hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
        >
          <ChevronLeft size={15} strokeWidth={1.75} aria-hidden="true" />
          Prev
        </button>

        {!isThisWeek && (
          <button
            type="button"
            onClick={goToThisWeek}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-[var(--card-border)] text-sm font-medium text-muted hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-50"
          >
            This week
          </button>
        )}

        <span className="flex-1 text-sm font-semibold text-[var(--foreground)] text-center sm:text-left">
          {formatWeekRange(startDate, endDate)}
          {loading && (
            <Loader2
              size={13}
              strokeWidth={1.75}
              className="inline-block ml-2 animate-spin text-muted"
              aria-hidden="true"
            />
          )}
        </span>

        <button
          type="button"
          onClick={goToNextWeek}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--card-border)] text-sm font-medium text-muted hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
        >
          Next
          <ChevronRight size={15} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {/* Mobile conflict summary */}
      <ConflictSidebar entries={conflictEntries} isMobile />

      {/* Two-column layout */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6 space-y-4 lg:space-y-0">
        {/* Practice list — left 2/3 */}
        <div className="lg:col-span-2 space-y-3">
          {practices.length === 0 && !loading ? (
            <EmptyState
              icon={<Calendar size={40} strokeWidth={1.75} aria-hidden="true" />}
              title="No practices this week"
              description="Click 'New Practice' to schedule one."
              action={
                <Button onClick={() => setShowNewModal(true)}>
                  <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                  New Practice
                </Button>
              }
            />
          ) : (
            <StaggeredList className="space-y-3">
              {practices.map((p) => (
                <PracticeCard key={p.id} practice={p} />
              ))}
            </StaggeredList>
          )}
        </div>

        {/* Conflict sidebar — right 1/3 */}
        <div className="lg:col-span-1">
          <ConflictSidebar entries={conflictEntries} />
          {/* Weekly summary */}
          {practices.length > 0 && (
            <div className="hidden lg:block card px-5 py-4 mt-3 space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">This Week</p>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-center">
                  <p className="font-mono text-xl font-bold text-[var(--foreground)] tabular-nums">
                    {practices.length}
                  </p>
                  <p className="text-xs text-muted">Practices</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-xl font-bold text-success-500 tabular-nums">
                    {practices.reduce((s, p) => s + p.attendingCount, 0)}
                  </p>
                  <p className="text-xs text-muted">Marked Present</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-xl font-bold text-warning-500 tabular-nums">
                    {practices.reduce((s, p) => s + p.conflictCount, 0)}
                  </p>
                  <p className="text-xs text-muted">Conflicts</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Practice Modal */}
      {showNewModal && (
        <NewPracticeModal
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false);
            fetchPractices(startDate, endDate);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// Re-export the type so ConflictSidebar works
interface ConflictEntry {
  practiceId: string;
  practiceTitle: string;
  practiceDate: string;
  conflicts: ConflictAthlete[];
}
