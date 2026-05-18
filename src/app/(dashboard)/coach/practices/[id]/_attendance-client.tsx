"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  BookOpen,
  Users,
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { AttendanceStatus, PracticeListItem, ConflictAthlete } from "@/lib/data/practices";
import { ProgressBar } from "@/components/ui/ProgressBar";

// ─── Types ────────────────────────────────────────────────────────────────────

type AttStatus = AttendanceStatus | null;

interface EligibleAthlete {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  events: string[];
  conflict: ConflictAthlete | null;
}

interface DetailData {
  practice: PracticeListItem;
  conflicts: ConflictAthlete[];
  eligibleAthletes: EligibleAthlete[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CYCLE = [null, "PRESENT", "LATE", "ABSENT", "EXCUSED"] as const;

function nextStatus(current: AttStatus): AttStatus {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

const EVENT_SHORT: Record<string, string> = {
  SHOT_PUT: "SP",
  DISCUS: "DT",
  HAMMER: "HT",
  JAVELIN: "JT",
};

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    bg: string;
    border: string;
    text: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: React.ElementType<any>;
    dotColor: string;
  }
> = {
  PRESENT: {
    label: "PRESENT",
    bg: "bg-success-500/10",
    border: "border-l-4 border-success-500",
    text: "text-success-600 dark:text-success-400",
    icon: CheckCircle2,
    dotColor: "bg-success-500",
  },
  LATE: {
    label: "LATE",
    bg: "bg-warning-500/10",
    border: "border-l-4 border-warning-500",
    text: "text-warning-600 dark:text-warning-400",
    icon: Clock,
    dotColor: "bg-warning-500",
  },
  ABSENT: {
    label: "ABSENT",
    bg: "bg-danger-500/10",
    border: "border-l-4 border-danger-500",
    text: "text-danger-600 dark:text-danger-400",
    icon: XCircle,
    dotColor: "bg-danger-500",
  },
  EXCUSED: {
    label: "EXCUSED",
    bg: "bg-info-500/10",
    border: "border-l-4 border-info-500",
    text: "text-info-600 dark:text-info-400",
    icon: BookOpen,
    dotColor: "bg-info-500",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

// ─── Athlete Card ─────────────────────────────────────────────────────────────

interface AthleteCardProps {
  athlete: EligibleAthlete;
  status: AttStatus;
  notes: string | null;
  onTap: (id: string) => void;
  onLongPress: (id: string) => void;
  notesExpanded: boolean;
  onNotesSave: (id: string, notes: string) => void;
  onNotesCancel: (id: string) => void;
}

function AthleteCard({
  athlete,
  status,
  notes,
  onTap,
  onLongPress,
  notesExpanded,
  onNotesSave,
  onNotesCancel,
}: AthleteCardProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const [draftNotes, setDraftNotes] = useState(notes ?? "");

  useEffect(() => {
    setDraftNotes(notes ?? "");
  }, [notes]);

  const cfg = status ? STATUS_CONFIG[status] : null;

  function handlePointerDown() {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      if ("vibrate" in navigator) navigator.vibrate(50);
      onLongPress(athlete.id);
    }, 500);
  }

  function handlePointerUp() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  function handlePointerMove() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  function handleClick() {
    if (didLongPress.current) return;
    if ("vibrate" in navigator) navigator.vibrate(20);
    onTap(athlete.id);
  }

  return (
    <div className="space-y-0">
      <motion.div
        layout
        animate={{
          backgroundColor: cfg ? cfg.bg.replace("bg-", "").replace("/10", "") : "transparent",
        }}
        transition={{ duration: 0.15 }}
        className={`card flex items-center gap-3 p-4 min-h-[64px] cursor-pointer select-none touch-manipulation active:scale-[0.99] transition-transform ${
          cfg ? `${cfg.bg} ${cfg.border}` : ""
        }`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`${athlete.firstName} ${athlete.lastName} — ${status ?? "Unmarked"}. Tap to change status.`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {/* Avatar */}
        {athlete.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={athlete.avatarUrl}
            alt={`${athlete.firstName} ${athlete.lastName}`}
            className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-[var(--card-border)]"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center shrink-0 text-sm font-bold text-surface-500">
            {getInitials(athlete.firstName, athlete.lastName)}
          </div>
        )}

        {/* Name + events */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)] truncate">
            {athlete.firstName} {athlete.lastName}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <div className="flex gap-1">
              {athlete.events.map((e) => (
                <Badge key={e} variant="neutral" className="text-nano px-1.5 py-0">
                  {EVENT_SHORT[e] ?? e}
                </Badge>
              ))}
            </div>
            {athlete.conflict && (
              <span className="flex items-center gap-1 text-nano text-warning-600 dark:text-warning-400">
                <AlertTriangle size={9} strokeWidth={1.75} aria-hidden="true" />
                {athlete.conflict.reason}
              </span>
            )}
          </div>
        </div>

        {/* Status indicator */}
        <div className="shrink-0 flex items-center gap-1.5">
          {cfg ? (
            <>
              <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} aria-hidden="true" />
              <span className={`text-micro font-bold uppercase tracking-wider ${cfg.text}`}>
                {cfg.label}
              </span>
            </>
          ) : (
            <span className="text-micro font-medium text-muted uppercase tracking-wider">—</span>
          )}
          {notes && (
            <Pencil size={11} strokeWidth={1.75} className="text-muted ml-1" aria-hidden="true" />
          )}
        </div>
      </motion.div>

      {/* Inline notes expansion */}
      <AnimatePresence>
        {notesExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-surface-50 dark:bg-surface-900 border border-t-0 border-[var(--card-border)] rounded-b-xl px-4 py-3 space-y-2">
              <textarea
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                placeholder="Add a note (e.g. 'Had class until 3:15')"
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] text-sm text-[var(--foreground)] focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none placeholder:text-muted"
                autoFocus
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => onNotesCancel(athlete.id)}
                  className="text-xs text-muted hover:text-[var(--foreground)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onNotesSave(athlete.id, draftNotes)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-semibold hover:bg-primary-600 transition-colors"
                >
                  <Check size={11} strokeWidth={2.5} aria-hidden="true" />
                  Save Note
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Save Status Indicator ────────────────────────────────────────────────────

function SaveStatus({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  return (
    <AnimatePresence>
      <motion.div
        key={state}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className={`flex items-center gap-1.5 text-xs font-medium ${
          state === "saving"
            ? "text-muted"
            : state === "saved"
              ? "text-success-500"
              : "text-danger-500"
        }`}
      >
        {state === "saving" && (
          <Loader2 size={11} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
        )}
        {state === "saved" && <Check size={11} strokeWidth={2.5} aria-hidden="true" />}
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save failed"}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Edit Practice Modal ──────────────────────────────────────────────────────

const TIME_OPTIONS_EDIT = (() => {
  const opts: { value: string; label: string }[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break;
      const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const ampm = h >= 12 ? "PM" : "AM";
      const hour = h % 12 === 0 ? 12 : h % 12;
      const label = `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
      opts.push({ value: val, label });
    }
  }
  return opts;
})();

function EditPracticeModal({
  practice,
  onClose,
  onSaved,
}: {
  practice: PracticeListItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: showError } = useToast();
  const [title, setTitle] = useState(practice.title);
  const [date, setDate] = useState(practice.date);
  const [startTime, setStartTime] = useState(practice.startTime);
  const [endTime, setEndTime] = useState(practice.endTime);
  const [location, setLocation] = useState(practice.location ?? "");
  const [notes, setNotes] = useState(practice.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/coach/practices/${practice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          title: title.trim(),
          date,
          startTime,
          endTime,
          location: location.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update practice");
      }
      success("Practice Updated");
      onSaved();
    } catch (err) {
      showError("Error", err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Practice"
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
              {TIME_OPTIONS_EDIT.map((o) => (
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
              {TIME_OPTIONS_EDIT.filter((o) => o.value > startTime).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Input
          label="Location (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <div>
          <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-sm text-[var(--foreground)] focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none placeholder:text-muted"
          />
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AttendanceClient({
  practiceId,
  initialDetail,
}: {
  practiceId: string;
  initialDetail: DetailData;
}) {
  const router = useRouter();
  const { success, error: showError, warning } = useToast();

  // ── State ──
  const [practice, setPractice] = useState(initialDetail.practice);
  const [eligibleAthletes] = useState<EligibleAthlete[]>(initialDetail.eligibleAthletes);

  // Local attendance map: athleteId → status
  const [statusMap, setStatusMap] = useState<Map<string, AttStatus>>(() => {
    const m = new Map<string, AttStatus>();
    for (const a of initialDetail.practice.attendance) {
      m.set(a.athleteId, a.status);
    }
    return m;
  });

  // Local notes map: athleteId → notes
  const [notesMap, setNotesMap] = useState<Map<string, string | null>>(() => {
    const m = new Map<string, string | null>();
    for (const a of initialDetail.practice.attendance) {
      if (a.notes) m.set(a.athleteId, a.notes);
    }
    return m;
  });

  // Queue of pending saves: athleteId → { status, notes }
  const pendingQueue = useRef<Map<string, { status: AttStatus; notes?: string }>>(new Map());

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Notes expansion state
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Modals
  const [showEdit, setShowEdit] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // ── Derived ──
  const markedCount = useMemo(() => {
    let count = 0;
    for (const [, s] of statusMap) {
      if (s !== null) count++;
    }
    return count;
  }, [statusMap]);

  const unmarkedCount = eligibleAthletes.filter((a) => !statusMap.get(a.id)).length;

  const progressPct =
    eligibleAthletes.length > 0 ? Math.round((markedCount / eligibleAthletes.length) * 100) : 0;

  // Sort: unmarked first, then by name
  const sortedAthletes = useMemo(() => {
    return [...eligibleAthletes].sort((a, b) => {
      const aStatus = statusMap.get(a.id);
      const bStatus = statusMap.get(b.id);
      const aNull = aStatus === null || aStatus === undefined;
      const bNull = bStatus === null || bStatus === undefined;
      if (aNull && !bNull) return -1;
      if (!aNull && bNull) return 1;
      return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
    });
  }, [eligibleAthletes, statusMap]);

  // ── Auto-save ──
  function flushSaves(queue: Map<string, { status: AttStatus; notes?: string }>) {
    if (queue.size === 0) return;
    setSaveState("saving");

    const updates = Array.from(queue.entries()).map(([athleteId, { status, notes }]) => ({
      athleteId,
      status,
      notes,
    }));

    fetch(`/api/coach/practices/${practiceId}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ updates }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Save failed");
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      })
      .catch(() => {
        setSaveState("error");
        // Rollback would require a snapshot; for now just show error
        showError("Save Failed", "Could not save attendance. Please try again.");
      });
  }

  function scheduleFlush() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const queue = new Map(pendingQueue.current);
      pendingQueue.current.clear();
      flushSaves(queue);
    }, 1000);
  }

  // ── Tap handler ──
  const handleTap = useCallback(
    (athleteId: string) => {
      setStatusMap((prev) => {
        const current = prev.get(athleteId) ?? null;
        const next = nextStatus(current);
        const updated = new Map(prev);
        updated.set(athleteId, next);

        pendingQueue.current.set(athleteId, {
          status: next,
          notes: notesMap.get(athleteId) ?? undefined,
        });
        scheduleFlush();
        return updated;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notesMap]
  );

  // ── Long-press handler ──
  const handleLongPress = useCallback((athleteId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(athleteId)) {
        next.delete(athleteId);
      } else {
        next.add(athleteId);
      }
      return next;
    });
  }, []);

  // ── Notes save ──
  const handleNotesSave = useCallback(
    (athleteId: string, notes: string) => {
      setNotesMap((prev) => {
        const updated = new Map(prev);
        updated.set(athleteId, notes || null);
        return updated;
      });
      setExpandedNotes((prev) => {
        const next = new Set(prev);
        next.delete(athleteId);
        return next;
      });
      pendingQueue.current.set(athleteId, {
        status: statusMap.get(athleteId) ?? null,
        notes: notes || undefined,
      });
      scheduleFlush();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statusMap]
  );

  const handleNotesCancel = useCallback((athleteId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      next.delete(athleteId);
      return next;
    });
  }, []);

  // ── Mark All Present ──
  async function handleMarkAllPresent() {
    const alreadyMarked = eligibleAthletes.filter(
      (a) => statusMap.get(a.id) !== null && statusMap.get(a.id) !== undefined
    );

    if (
      alreadyMarked.length > 0 &&
      !window.confirm(
        `This will mark ${unmarkedCount} unmarked athlete${unmarkedCount !== 1 ? "s" : ""} as Present. Continue?`
      )
    ) {
      return;
    }

    // Optimistic: set all unmarked → PRESENT
    setStatusMap((prev) => {
      const updated = new Map(prev);
      for (const a of eligibleAthletes) {
        if (!prev.get(a.id)) {
          updated.set(a.id, "PRESENT");
        }
      }
      return updated;
    });

    try {
      const res = await fetch(
        `/api/coach/practices/${practiceId}/attendance?action=mark-all-present`,
        {
          method: "POST",
          headers: csrfHeaders(),
        }
      );
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      success(
        "All Present",
        `Marked ${json.data.marked} athlete${json.data.marked !== 1 ? "s" : ""} as present`
      );
    } catch {
      showError("Error", "Could not mark all present. Please try again.");
      // Refetch to sync
      fetch(`/api/coach/practices/${practiceId}/attendance`)
        .then((r) => r.json())
        .then((json) => {
          if (json.data?.attendance) {
            const m = new Map<string, AttStatus>();
            for (const a of json.data.attendance) {
              m.set(a.athleteId, a.status);
            }
            setStatusMap(m);
          }
        })
        .catch(() => {});
    }
  }

  // ── Cancel practice ──
  async function handleCancelPractice() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/coach/practices/${practiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) throw new Error("Failed");
      warning("Practice Cancelled", practice.title);
      setShowCancelConfirm(false);
      router.push("/coach/practices");
    } catch {
      showError("Error", "Could not cancel practice.");
    } finally {
      setCancelling(false);
    }
  }

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return (
    <div className="space-y-0 pb-8">
      <ScrollProgressBar />

      {/* Top bar */}
      <div className="flex items-center gap-3 pb-4 border-b border-[var(--card-border)]">
        <Link
          href="/coach/practices"
          className="flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors shrink-0"
        >
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Practices
        </Link>

        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-lg font-bold text-[var(--foreground)] truncate">
            {practice.title}
          </h1>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted mt-0.5">
            <span className="font-mono tabular-nums">{formatDate(practice.date)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {formatTime(practice.startTime)} – {formatTime(practice.endTime)}
            </span>
            {practice.location && (
              <>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1">
                  <MapPin size={11} strokeWidth={1.75} aria-hidden="true" />
                  {practice.location}
                </span>
              </>
            )}
            {practice.status === "CANCELLED" && <Badge variant="danger">Cancelled</Badge>}
          </div>
        </div>

        {/* Marked count */}
        <div className="shrink-0 text-right">
          <span className="font-mono text-sm font-bold tabular-nums text-[var(--foreground)]">
            {markedCount}/{eligibleAthletes.length}
          </span>
          <p className="text-nano text-muted">marked</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="py-3">
        <ProgressBar value={progressPct} size="sm" />
        <p className="text-xs text-muted mt-1.5">
          {markedCount} of {eligibleAthletes.length} athletes marked
        </p>
      </div>

      {/* Bulk actions row */}
      <div className="flex items-center gap-2 flex-wrap py-3 sticky top-0 z-10 bg-[var(--bg)] border-b border-[var(--card-border)] -mx-4 px-4 sm:-mx-6 sm:px-6">
        <Button
          onClick={handleMarkAllPresent}
          disabled={unmarkedCount === 0 || practice.status === "CANCELLED"}
          className="shrink-0"
        >
          <CheckCircle2 size={15} strokeWidth={1.75} aria-hidden="true" />
          Mark All Present
          {unmarkedCount > 0 && (
            <span className="ml-1 font-mono text-xs opacity-75">({unmarkedCount})</span>
          )}
        </Button>

        <div className="flex items-center gap-2 ml-auto">
          <SaveStatus state={saveState} />
          <Button variant="ghost" onClick={() => setShowEdit(true)} className="gap-1.5">
            <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
          {practice.status !== "CANCELLED" && (
            <Button variant="danger" onClick={() => setShowCancelConfirm(true)} className="gap-1.5">
              <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden sm:inline">Cancel Practice</span>
            </Button>
          )}
        </div>
      </div>

      {/* Athlete list */}
      <div className="pt-4 space-y-2">
        {sortedAthletes.length === 0 ? (
          <div className="py-12 text-center">
            <Users
              size={36}
              strokeWidth={1.75}
              className="text-surface-300 dark:text-surface-600 mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="text-sm text-muted">No athletes in this practice.</p>
          </div>
        ) : (
          sortedAthletes.map((athlete) => (
            <AthleteCard
              key={athlete.id}
              athlete={athlete}
              status={statusMap.get(athlete.id) ?? null}
              notes={notesMap.get(athlete.id) ?? null}
              onTap={handleTap}
              onLongPress={handleLongPress}
              notesExpanded={expandedNotes.has(athlete.id)}
              onNotesSave={handleNotesSave}
              onNotesCancel={handleNotesCancel}
            />
          ))
        )}
      </div>

      {/* Edit modal */}
      {showEdit && (
        <EditPracticeModal
          practice={practice}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            // Refetch practice details
            fetch(`/api/coach/practices/${practiceId}`)
              .then((r) => r.json())
              .then((json) => {
                if (json.data?.practice) {
                  setPractice(json.data.practice);
                }
              })
              .catch(() => {});
            router.refresh();
          }}
        />
      )}

      {/* Cancel confirm modal */}
      {showCancelConfirm && (
        <Modal
          open
          onClose={() => setShowCancelConfirm(false)}
          title="Cancel Practice?"
          description={`This will mark "${practice.title}" as cancelled. Athletes will no longer be expected.`}
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button variant="ghost" onClick={() => setShowCancelConfirm(false)}>
                Keep Practice
              </Button>
              <Button variant="danger" onClick={handleCancelPractice} disabled={cancelling}>
                {cancelling ? "Cancelling…" : "Cancel Practice"}
              </Button>
            </div>
          }
        >
          <div />
        </Modal>
      )}
    </div>
  );
}
