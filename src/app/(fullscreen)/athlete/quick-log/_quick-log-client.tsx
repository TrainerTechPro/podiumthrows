"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { NumberInput } from "@/components/ui/NumberInput";
import { useOnlineStatus } from "@/lib/pwa/online-status";
import {
  queueQuickLogThrow,
  getPendingQuickLogCount,
  syncQuickLogQueue,
} from "@/lib/pwa/quick-log-queue";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { useDraftResumeToast } from "@/components/ui/DraftResumeToast";
import { PRCelebration } from "@/components/ui/PRCelebration";
import { useDraftPersistence } from "@/lib/draft-persistence";
import { cn, formatEventType, formatPreviousBestDate } from "@/lib/utils";
import { haptic } from "@/lib/haptic";
import { logger } from "@/lib/logger";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Implement {
  event: string;
  implementWeight: number;
  label: string; // e.g. "Shot Put · 16 lb" or "Shot Put · 7.26kg"
  /// Catalog displayLabel without the event prefix ("16 lb" / "7.26 kg" /
  /// "18 lb · 3/4 wire"). Renders in the big header pill so an athlete who
  /// throws 16 lb sees "16 lb", not "7.26kg". Null when the preset weight
  /// has no catalog match (very rare).
  displayLabel?: string | null;
}

interface RecentThrow {
  id: string; // may be temp id for optimistic entries
  event: string;
  implementWeight: number;
  /// Catalog displayLabel ("16 lb", "7.26 kg") when the row resolves to a
  /// catalog implement. Pre-catalog rows leave this null and the UI falls
  /// back to the kg-format pattern. Not currently rendered (recent-throw
  /// chip shows distance only) but plumbed through for future surfaces.
  implementLabel?: string | null;
  distance: number | null;
  feeling: string | null;
  notes: string | null;
  isOptimistic?: boolean;
}

interface QuickLogData {
  currentImplement: {
    event: string;
    implementWeight: number;
    displayLabel?: string | null;
  } | null;
  recentThrows: RecentThrow[];
  throwCount: number;
  availableImplements: {
    event: string;
    implementWeight: number;
    displayLabel?: string | null;
  }[];
  weightPresets?: Record<string, number[]>;
  /// Per-event preset list with the catalog displayLabel resolved server-side.
  /// Falls back to `${kg}kg` when null. Kept alongside the legacy `weightPresets`
  /// field so older deploys of the client still parse the response.
  weightPresetLabels?: Record<string, Array<{ kg: number; label: string | null }>>;
  compWeights?: Record<string, number>;
  sessionFocus: string | null;
}

type FeelingOption = "bad" | "ok" | "great";

const FEELING_EMOJI: Record<FeelingOption, string> = {
  bad: "😞",
  ok: "😐",
  great: "🔥",
};

const FEELING_LABELS: Record<FeelingOption, string> = {
  bad: "Bad",
  ok: "Ok",
  great: "Great",
};

const IMPLEMENT_KEY = "podium-quick-log-implement";
const SWIPE_THRESHOLD = 50;
const SWIPE_OPACITY_RANGE = 80; // px of drag to fade to min opacity (matches prior useTransform range)
const DRAG_ELASTICITY = 0.15; // matches prior framer-motion dragElastic

/* ─── Build implement list from raw data ─────────────────────────────────── */

function buildImplementList(
  available: { event: string; implementWeight: number; displayLabel?: string | null }[],
  current: { event: string; implementWeight: number; displayLabel?: string | null } | null
): Implement[] {
  const labelFor = (i: { event: string; implementWeight: number; displayLabel?: string | null }) =>
    `${i.event} · ${i.displayLabel ?? `${i.implementWeight}kg`}`;

  const list: Implement[] = available.map((i) => ({
    event: i.event,
    implementWeight: i.implementWeight,
    label: labelFor(i),
    displayLabel: i.displayLabel ?? null,
  }));

  // If no available implements, create a default from current
  if (list.length === 0 && current) {
    list.push({
      event: current.event,
      implementWeight: current.implementWeight,
      label: labelFor(current),
      displayLabel: current.displayLabel ?? null,
    });
  }

  // Default fallback
  if (list.length === 0) {
    list.push({
      event: "Shot Put",
      implementWeight: 7.26,
      label: "Shot Put · 7.26 kg",
      displayLabel: "7.26 kg",
    });
  }

  return list;
}

/* ─── Connection status chip ─────────────────────────────────────────────── */

interface ConnectionChipProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
}

function ConnectionChip({ isOnline, pendingCount, isSyncing }: ConnectionChipProps) {
  let label: string;
  let dotClass: string;

  if (!isOnline && pendingCount === 0) {
    label = "Offline";
    dotClass = "bg-danger-500";
  } else if (!isOnline && pendingCount > 0) {
    label = `Offline — ${pendingCount} queued`;
    dotClass = "bg-danger-500";
  } else if (isOnline && isSyncing && pendingCount > 0) {
    label = `Syncing ${pendingCount}...`;
    dotClass = "bg-warning-500 animate-pulse";
  } else {
    label = "Online";
    dotClass = "bg-success-500";
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-700 border border-surface-600 text-xs text-[var(--muted)]">
      {isSyncing && isOnline && pendingCount > 0 ? (
        <Loader2 size={10} className="animate-spin text-warning-500" aria-hidden="true" />
      ) : (
        <span className={cn("w-2 h-2 rounded-full shrink-0", dotClass)} aria-hidden="true" />
      )}
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
}

/* ─── Recent throw chip ──────────────────────────────────────────────────── */

interface ThrowChipProps {
  throw_: RecentThrow;
  index: number;
  onTap: (throw_: RecentThrow) => void;
}

function ThrowChip({ throw_, index, onTap }: ThrowChipProps) {
  const feelingEmoji =
    throw_.feeling === "great"
      ? "🔥"
      : throw_.feeling === "bad"
        ? "😞"
        : throw_.feeling === "ok"
          ? "😐"
          : "";

  const label = throw_.distance
    ? `${throw_.distance.toFixed(2)}m${feelingEmoji ? ` ${feelingEmoji}` : ""}`
    : `#${index + 1}${feelingEmoji ? ` ${feelingEmoji}` : ""}`;

  return (
    <button
      onClick={() => onTap(throw_)}
      className={cn(
        "shrink-0 px-3 py-2 rounded-xl bg-surface-700/80 border border-surface-600/60",
        "text-xs font-mono tabular-nums text-[var(--foreground)]",
        "hover:bg-surface-600/80 transition-colors",
        "active:scale-[0.93] motion-safe:animate-chip-in",
        "cursor-pointer min-w-[64px] text-center",
        throw_.isOptimistic && "opacity-60"
      )}
      aria-label={`Edit throw: ${label}`}
    >
      {label}
    </button>
  );
}

/* ─── Implement dot indicator ────────────────────────────────────────────── */

interface DotIndicatorProps {
  count: number;
  current: number;
}

function DotIndicator({ count, current }: DotIndicatorProps) {
  if (count <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === current;
        return (
          <span
            key={i}
            className={cn(
              "rounded-full transition-colors duration-200 ease-out",
              // Reserve the active footprint so inactive dots don't shift layout.
              "w-2.5 h-2.5 flex items-center justify-center",
              isActive
                ? "bg-primary-500 scale-100 opacity-100"
                : "bg-surface-400 scale-[0.65] opacity-40"
            )}
          />
        );
      })}
    </div>
  );
}

/* ─── Quick Entry Bottom Sheet ───────────────────────────────────────────── */

/**
 * Controlled value for the new-throw composition. When `controlled` is set,
 * the sheet reads from / writes to the parent's value instead of its own
 * local useState so the parent can persist the in-flight composition to
 * IndexedDB and recover it after a tab kill / reload.
 *
 * Editing-existing-throw mode keeps local state — there's nothing to
 * recover, the throw is already on the server.
 */
export interface QuickEntryDraft {
  distance: number | null;
  feeling: FeelingOption | null;
  notes: string;
}

const EMPTY_QUICK_ENTRY_DRAFT: QuickEntryDraft = {
  distance: null,
  feeling: null,
  notes: "",
};

interface QuickEntrySheetProps {
  isOpen: boolean;
  editingThrow: RecentThrow | null; // null = new throw
  controlled?: { value: QuickEntryDraft; onChange: (next: QuickEntryDraft) => void };
  onClose: () => void;
  onSave: (data: { distance: number | null; feeling: FeelingOption | null; notes: string }) => void;
}

function QuickEntrySheet({
  isOpen,
  editingThrow,
  controlled,
  onClose,
  onSave,
}: QuickEntrySheetProps) {
  const [localDistance, setLocalDistance] = useState<number | null>(null);
  const [localFeeling, setLocalFeeling] = useState<FeelingOption | null>(null);
  const [localNotes, setLocalNotes] = useState<string>("");

  // For new throws the parent owns state; for editing-existing we keep local state.
  const distance = controlled ? controlled.value.distance : localDistance;
  const feeling = controlled ? controlled.value.feeling : localFeeling;
  const notes = controlled ? controlled.value.notes : localNotes;

  const setDistance = useCallback(
    (next: number | null) => {
      if (controlled) controlled.onChange({ ...controlled.value, distance: next });
      else setLocalDistance(next);
    },
    [controlled]
  );
  const setFeeling = useCallback(
    (next: FeelingOption | null) => {
      if (controlled) controlled.onChange({ ...controlled.value, feeling: next });
      else setLocalFeeling(next);
    },
    [controlled]
  );
  const setNotes = useCallback(
    (next: string) => {
      if (controlled) controlled.onChange({ ...controlled.value, notes: next });
      else setLocalNotes(next);
    },
    [controlled]
  );

  // Editing-existing prefill / close-reset only applies to local-state mode.
  // Controlled mode is fully driven by the parent.
  useEffect(() => {
    if (controlled) return;
    if (isOpen) {
      setLocalDistance(editingThrow?.distance ?? null);
      setLocalFeeling((editingThrow?.feeling as FeelingOption | null) ?? null);
      setLocalNotes(editingThrow?.notes ?? "");
    } else {
      setLocalDistance(null);
      setLocalFeeling(null);
      setLocalNotes("");
    }
  }, [isOpen, editingThrow, controlled]);

  const handleSave = useCallback(() => {
    onSave({
      distance,
      feeling,
      notes: notes.trim(),
    });
  }, [distance, feeling, notes, onSave]);

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      side="bottom"
      size="lg"
      ariaLabel={editingThrow ? "Edit throw details" : "Add throw details"}
    >
      <div className="space-y-5" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
          {editingThrow ? "Edit Throw" : "Add Details"}
        </p>

        {/* Distance */}
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1.5" htmlFor="ql-distance">
            Distance (meters)
          </label>
          <div className="relative">
            <NumberInput
              id="ql-distance"
              value={distance}
              onChange={setDistance}
              step={0.01}
              min={0}
              max={100}
              placeholder="—"
              inputClassName="w-full bg-surface-700 border-surface-600/60 rounded-xl px-4 py-3 text-lg font-mono text-[var(--foreground)] placeholder:text-surface-400 focus-visible:ring-primary-500/60 pr-10"
            />
            {distance != null && (
              <button
                onClick={() => setDistance(null)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-[var(--foreground)] p-1"
                aria-label="Clear distance"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>

        {/* Feeling */}
        <div>
          <p className="text-xs text-[var(--muted)] mb-2.5">How did it feel?</p>
          <div className="flex gap-3">
            {(["bad", "ok", "great"] as FeelingOption[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setFeeling(feeling === opt ? null : opt)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors",
                  feeling === opt
                    ? "bg-primary-500/20 border-primary-500/60 text-primary-400"
                    : "bg-surface-700 border-surface-600/40 text-[var(--muted)] hover:border-surface-500"
                )}
                aria-pressed={feeling === opt}
                aria-label={FEELING_LABELS[opt]}
              >
                <span className="text-2xl leading-none">{FEELING_EMOJI[opt]}</span>
                <span className="text-nano font-semibold uppercase tracking-wider">
                  {FEELING_LABELS[opt]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1.5" htmlFor="ql-notes">
            Note
          </label>
          <input
            id="ql-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional note..."
            className="w-full bg-surface-700 border border-surface-600/60 rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-surface-400 focus-visible:outline-none focus:ring-2 focus:ring-primary-500/60"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={handleSave}
            className="w-full py-4 rounded-2xl bg-primary-500 text-surface-950 font-heading font-bold text-base hover:bg-primary-400 active:scale-[0.98] transition-colors"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl text-[var(--muted)] text-sm hover:text-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function QuickLogClient({ userId }: { userId: string }) {
  // Data state
  const [implements_, setImplements] = useState<Implement[]>([]);
  const [implementIndex, setImplementIndex] = useState(0);
  const [throwCount, setThrowCount] = useState(0);
  const [recentThrows, setRecentThrows] = useState<RecentThrow[]>([]);
  const [sessionFocus, setSessionFocus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Persisted in-flight throw composition. Survives tab kill / reload —
  // so the athlete who's typed a distance + note and then loses the
  // browser doesn't lose the entry. Cleared on successful submit and on
  // explicit cancel.
  const [newThrowDraft, setNewThrowDraft, draftStatus] = useDraftPersistence<QuickEntryDraft>(
    // v2 — distance shape changed from string to number | null (NumberInput migration)
    `${userId}:quick-log:compose:v2`,
    EMPTY_QUICK_ENTRY_DRAFT
  );
  const showResumeToast = useDraftResumeToast();
  const resumeToastFiredRef = useRef(false);

  // Weight presets for the weight picker
  const [weightPresets, setWeightPresets] = useState<Record<string, number[]>>({});
  // Per-event preset list with catalog displayLabel resolved server-side.
  // Used by the weight-picker pills + the changeWeight handler so the big
  // header refreshes with the right label when the athlete picks a new weight.
  const [weightPresetLabels, setWeightPresetLabels] = useState<
    Record<string, Array<{ kg: number; label: string | null }>>
  >({});
  const [compWeights, setCompWeights] = useState<Record<string, number>>({});
  const [weightPickerOpen, setWeightPickerOpen] = useState(false);

  // UI state
  const [glowActive, setGlowActive] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingThrow, setEditingThrow] = useState<RecentThrow | null>(null);
  const [isNewThrow, setIsNewThrow] = useState(false); // sheet opened for new throw (long-press)
  const [implementSlideDir, setImplementSlideDir] = useState<"left" | "right">("left");
  const [implementAnimKey, setImplementAnimKey] = useState(0);

  // Connection / sync state
  const { isOnline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const { success: toastSuccess, error: toastError, celebration: toastCelebration } = useToast();

  // PR celebration overlay — populated when the server reports isPersonalBest.
  const [prCelebration, setPrCelebration] = useState<{
    show: boolean;
    event?: string;
    distance?: number;
  }>({ show: false });

  // Long-press state. We use `onClick` for the actual tap (most reliable
  // cross-browser, especially on iOS where pointerup races with gesture
  // detection), and pointer events ONLY to time the long-press.
  // `longPressTriggered` is used to suppress the trailing click after a
  // long-press has already opened the sheet.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // Reduced motion — reactive to system changes, SSR-safe
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* ── Initial data load ───────────────────────────────────────────────── */

  useEffect(() => {
    const loadTimer = setTimeout(() => setIsLoading(false), 500); // max skeleton duration

    fetch("/api/athlete/quick-log")
      .then((r) => (r.ok ? r.json() : null))
      .then((raw: { success: boolean; data: QuickLogData } | null) => {
        clearTimeout(loadTimer);
        const data = raw?.data ?? null;

        if (!data) {
          setIsLoading(false);
          return;
        }

        const list = buildImplementList(data.availableImplements, data.currentImplement);
        setImplements(list);
        setThrowCount(data.throwCount);
        setRecentThrows(data.recentThrows ?? []);
        setSessionFocus(data.sessionFocus ?? null);
        if (data.weightPresets) setWeightPresets(data.weightPresets);
        if (data.weightPresetLabels) setWeightPresetLabels(data.weightPresetLabels);
        if (data.compWeights) setCompWeights(data.compWeights);

        // Restore saved implement selection (event + weight)
        const saved = localStorage.getItem(IMPLEMENT_KEY);
        if (saved) {
          const [savedEvent, savedWeightStr] = saved.split("|");
          const savedWeight = parseFloat(savedWeightStr);

          // Find the matching event in the list
          const eventIndex = list.findIndex((i) => i.event === savedEvent);
          if (eventIndex >= 0) {
            setImplementIndex(eventIndex);
            // If the saved weight differs from competition weight, update it
            if (
              Number.isFinite(savedWeight) &&
              Math.abs(list[eventIndex].implementWeight - savedWeight) > 0.01
            ) {
              list[eventIndex] = { ...list[eventIndex], implementWeight: savedWeight };
              setImplements([...list]);
            }
          }
        }

        setIsLoading(false);
      })
      .catch(() => {
        clearTimeout(loadTimer);
        setIsLoading(false);
      });

    return () => clearTimeout(loadTimer);
  }, []);

  /* ── Offline queue tracking ──────────────────────────────────────────── */

  useEffect(() => {
    getPendingQuickLogCount()
      .then(setPendingCount)
      .catch(() => {});
  }, []);

  // Auto-sync on reconnect
  useEffect(() => {
    if (!isOnline) return;

    getPendingQuickLogCount().then((count) => {
      if (count === 0) return;

      setIsSyncing(true);
      syncQuickLogQueue()
        .then(({ synced, failed }) => {
          if (failed > 0) {
            toastError(
              "Sync incomplete",
              `${synced} throw${synced !== 1 ? "s" : ""} synced, ${failed} failed — will retry next time you're online.`
            );
          } else if (synced > 0) {
            toastSuccess("Throws synced", `${synced} throw${synced !== 1 ? "s" : ""} saved.`);
          }

          const poll = setInterval(async () => {
            const remaining = await getPendingQuickLogCount();
            setPendingCount(remaining);
            if (remaining === 0) {
              clearInterval(poll);
              setIsSyncing(false);
            }
          }, 2000);

          // Safety cleanup after 60s
          setTimeout(() => {
            clearInterval(poll);
            setIsSyncing(false);
          }, 60_000);
        })
        .catch(() => {
          toastError(
            "Sync failed",
            "Couldn\u2019t sync your throws \u2014 will retry when connected."
          );
          setIsSyncing(false);
        });
    });
  }, [isOnline, toastSuccess, toastError]);

  /* ── Current implement ───────────────────────────────────────────────── */

  const currentImplement = implements_[implementIndex] ?? null;

  /* ── Switch implement ────────────────────────────────────────────────── */

  const switchImplement = useCallback(
    (dir: "prev" | "next") => {
      if (implements_.length <= 1) return;
      haptic.light();
      setImplementSlideDir(dir === "next" ? "left" : "right");
      setImplementAnimKey((k) => k + 1);
      setImplementIndex((idx) => {
        const next =
          dir === "next"
            ? (idx + 1) % implements_.length
            : (idx - 1 + implements_.length) % implements_.length;
        // Persist selection
        const impl = implements_[next];
        if (impl) {
          localStorage.setItem(IMPLEMENT_KEY, `${impl.event}|${impl.implementWeight}`);
        }
        return next;
      });
    },
    [implements_]
  );

  /* ── Change implement weight ─────────────────────────────────────────── */

  const changeWeight = useCallback(
    (newWeight: number) => {
      if (!currentImplement) return;
      haptic.light();
      // Look up the catalog displayLabel for the newly-selected weight so
      // the big header re-renders with "16 lb" / "7.26 kg" instead of the
      // previous label going stale.
      const newLabel =
        weightPresetLabels[currentImplement.event]?.find((p) => Math.abs(p.kg - newWeight) < 0.01)
          ?.label ?? null;
      // Update the current implement's weight in the list
      setImplements((prev) =>
        prev.map((impl, i) =>
          i === implementIndex
            ? { ...impl, implementWeight: newWeight, displayLabel: newLabel }
            : impl
        )
      );
      // Persist updated selection
      localStorage.setItem(IMPLEMENT_KEY, `${currentImplement.event}|${newWeight}`);
      setWeightPickerOpen(false);
    },
    [currentImplement, implementIndex, weightPresetLabels]
  );

  /* ── Log throw (immediate, no popover) ──────────────────────────────── */

  const logThrow = useCallback(
    async (opts?: { distance?: number | null; feeling?: FeelingOption | null; notes?: string }) => {
      if (!currentImplement) return;

      haptic.light();

      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const optimistic: RecentThrow = {
        id: tempId,
        event: currentImplement.event,
        implementWeight: currentImplement.implementWeight,
        distance: opts?.distance ?? null,
        feeling: opts?.feeling ?? null,
        notes: opts?.notes ?? null,
        isOptimistic: true,
      };

      // Optimistic update
      setThrowCount((c) => c + 1);
      setRecentThrows((prev) => [optimistic, ...prev].slice(0, 3));

      // Glow flash
      setGlowActive(true);
      setTimeout(() => setGlowActive(false), 400);

      const payload = {
        event: currentImplement.event,
        implementWeight: currentImplement.implementWeight,
        distance: opts?.distance ?? undefined,
        feeling: opts?.feeling ?? undefined,
        notes: opts?.notes ?? undefined,
      };

      // Stable per-attempt id. Sent as X-Idempotency-Key on the direct POST,
      // and reused as the queue keyPath if we end up queueing — so the server
      // can dedup whichever attempt arrives first when a slow connection
      // races a queued retry. crypto.randomUUID() is in all modern browsers
      // and the iOS Safari we target.
      const clientId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      if (isOnline) {
        try {
          // AbortSignal.timeout may not exist on older iOS Safari — fallback to AbortController
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const res = await fetch("/api/athlete/quick-log", {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              "X-Idempotency-Key": clientId,
              ...csrfHeaders(),
            },
            body: JSON.stringify(payload),
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            // Read the actual error from the server for better diagnostics
            const errBody = await res.json().catch(() => ({ error: "Unknown error" }));
            const serverMsg = errBody?.error || `Server error (${res.status})`;
            throw new Error(serverMsg);
          }

          const postPayload = await res.json();
          const saved = postPayload?.data?.throw;
          const newCount = postPayload?.data?.throwCount;
          const previousBest: number | null = postPayload?.data?.previousBest ?? null;
          const previousBestDate: string | null = postPayload?.data?.previousBestDate ?? null;

          // Replace optimistic with real throw
          setRecentThrows((prev) =>
            prev.map((t) => (t.id === tempId ? { ...saved, isOptimistic: false } : t))
          );
          // Use authoritative count from server (fixes potential drift)
          // -1 means server couldn't count but throw WAS saved
          if (typeof newCount === "number" && newCount >= 0) setThrowCount(newCount);

          // PR celebration stack — full overlay + toast + haptic. Only fires
          // when the server confirms this throw set a new PR (saved.distance
          // is always truthy here since PR detection requires distance > 0
          // server-side, but check defensively).
          if (saved?.isPersonalBest && typeof saved.distance === "number") {
            haptic.pr();
            setPrCelebration({
              show: true,
              event: currentImplement.event,
              distance: saved.distance,
            });
            const eventLabel = formatEventType(currentImplement.event);
            const description =
              previousBest != null
                ? `${eventLabel} · +${(saved.distance - previousBest).toFixed(2)}m over your previous best${
                    previousBestDate ? ` from ${formatPreviousBestDate(previousBestDate)}` : ""
                  }`
                : `${eventLabel} · First-ever PR for this implement`;
            toastCelebration("New Personal Best!", {
              highlight: `${saved.distance.toFixed(2)}m`,
              description,
            });
          }
        } catch (err) {
          const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
          const isAbort = err instanceof DOMException && err.name === "AbortError";

          if (isTimeout || isAbort) {
            // Treat slow connection as offline — queue for sync instead of rolling back.
            // Same clientId as the direct attempt so the server dedups if both land.
            await queueQuickLogThrow({
              clientId,
              event: currentImplement.event,
              implementWeight: currentImplement.implementWeight,
              distance: opts?.distance ?? undefined,
              feeling: opts?.feeling ?? undefined,
              notes: opts?.notes ?? undefined,
              createdAt: Date.now(),
            });
            // Keep optimistic entry but mark it pending, increment pending count
            setRecentThrows((prev) =>
              prev.map((t) => (t.id === tempId ? { ...t, isOptimistic: true } : t))
            );
            setPendingCount((c) => c + 1);
          } else {
            // Roll back
            setThrowCount((c) => c - 1);
            setRecentThrows((prev) => prev.filter((t) => t.id !== tempId));
            const msg = err instanceof Error ? err.message : "Unknown error";
            toastError("Failed to save throw", msg);
          }
        }
      } else {
        // Queue for offline sync
        await queueQuickLogThrow({
          clientId,
          event: currentImplement.event,
          implementWeight: currentImplement.implementWeight,
          distance: opts?.distance ?? undefined,
          feeling: opts?.feeling ?? undefined,
          notes: opts?.notes ?? undefined,
          createdAt: Date.now(),
        });
        setPendingCount((c) => c + 1);
      }
    },
    [currentImplement, isOnline, toastError, toastCelebration]
  );

  /* ── Tap + long-press handlers ───────────────────────────────────────── */

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Keyboard activation (pointerType === "") must not trigger the long-press sheet
    if (e.pointerType !== "touch" && e.pointerType !== "mouse") return;
    longPressTriggered.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      haptic.medium();
      setIsNewThrow(true);
      setEditingThrow(null);
      setSheetOpen(true);
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    logThrow();
  }, [logThrow]);

  /* ── Swipe gesture (pointer events + CSS transform) ──────────────────── */

  // Dragging with rubber-band elasticity matches the prior framer dragElastic.
  // While dragging we write the offset straight to state; on release we snap
  // back to 0 with a CSS transition (driven by `isDraggingRef`).
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartX = useRef(0);
  const isDraggingRef = useRef(false);
  const dragPointerId = useRef<number | null>(null);

  const onDragPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch" && e.pointerType !== "mouse") return;
    isDraggingRef.current = true;
    dragStartX.current = e.clientX;
    dragPointerId.current = e.pointerId;
    // ok: setPointerCapture throws InvalidStateError if the pointer is already
    // captured elsewhere (e.g. concurrent scroll gesture). Swipe still works via
    // normal event propagation; drop a breadcrumb and continue.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      logger.debug("quick-log: setPointerCapture failed", {
        context: "ui",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
  }, []);

  const onDragPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || dragPointerId.current !== e.pointerId) return;
    const delta = e.clientX - dragStartX.current;
    setDragOffset(delta * DRAG_ELASTICITY);
  }, []);

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || dragPointerId.current !== e.pointerId) return;
      isDraggingRef.current = false;
      dragPointerId.current = null;
      const rawDelta = e.clientX - dragStartX.current;
      // ok: releasePointerCapture throws if capture was already lost (pointercancel
      // from the browser, element unmount, etc.). Drop a breadcrumb and continue.
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {
        logger.debug("quick-log: releasePointerCapture failed", {
          context: "ui",
          metadata: { reason: err instanceof Error ? err.message : "unknown" },
        });
      }
      if (rawDelta < -SWIPE_THRESHOLD) switchImplement("next");
      else if (rawDelta > SWIPE_THRESHOLD) switchImplement("prev");
      setDragOffset(0);
    },
    [switchImplement]
  );

  // Match the previous useTransform: opacity fades from 1 at offset=0 to 0.7 at |offset|≥80.
  const dragOpacity =
    1 - (Math.min(Math.abs(dragOffset), SWIPE_OPACITY_RANGE) / SWIPE_OPACITY_RANGE) * 0.3;

  /* ── Sheet save ──────────────────────────────────────────────────────── */

  const handleSheetSave = useCallback(
    async (data: { distance: number | null; feeling: FeelingOption | null; notes: string }) => {
      const wasNewThrow = isNewThrow;
      setSheetOpen(false);
      setIsNewThrow(false);
      setEditingThrow(null);

      if (wasNewThrow) {
        // Drop the persisted draft now that the throw is committed (online
        // path) or queued (offline path). logThrow handles both — neither
        // outcome should leave a "resume your unfinished throw" toast on
        // the next visit.
        setNewThrowDraft(EMPTY_QUICK_ENTRY_DRAFT);
        await draftStatus.clearDraft();
        // Log new throw with details
        await logThrow({
          distance: data.distance,
          feeling: data.feeling,
          notes: data.notes,
        });
      } else if (editingThrow) {
        // PATCH existing throw
        try {
          const res = await fetch("/api/athlete/quick-log", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({
              id: editingThrow.id,
              distance: data.distance,
              feeling: data.feeling,
              notes: data.notes,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const patchPayload = await res.json();
          const updated = patchPayload?.data?.throw;
          setRecentThrows((prev) =>
            prev.map((t) => (t.id === editingThrow.id ? { ...updated, isOptimistic: false } : t))
          );
        } catch {
          toastError("Failed to update throw", "Changes could not be saved.");
        }
      }
    },
    [isNewThrow, editingThrow, logThrow, toastError, setNewThrowDraft, draftStatus]
  );

  /* ── Open edit sheet for a chip ─────────────────────────────────────── */

  const openEditSheet = useCallback((throw_: RecentThrow) => {
    if (throw_.isOptimistic) return;
    setIsNewThrow(false);
    setEditingThrow(throw_);
    setSheetOpen(true);
  }, []);

  /* ── Sheet cancel (backdrop tap or Cancel button) ──────────────────── */

  const handleSheetClose = useCallback(async () => {
    const wasNewThrow = isNewThrow;
    setSheetOpen(false);
    setIsNewThrow(false);
    setEditingThrow(null);
    // Closing without saving is an explicit discard — drop the persisted
    // draft so the next visit doesn't surface a stale resume toast.
    if (wasNewThrow) {
      setNewThrowDraft(EMPTY_QUICK_ENTRY_DRAFT);
      await draftStatus.clearDraft();
    }
  }, [isNewThrow, setNewThrowDraft, draftStatus]);

  /* ── Resume toast for a recovered draft ────────────────────────────── */

  // One-shot per page load. Fires when the persisted draft has any content
  // and was last touched more than the toast threshold ago. The toast's
  // Continue action re-opens the sheet (already pre-populated by the hook);
  // Discard wipes the draft + form state.
  // Destructured here because draftStatus is a fresh object on every render
  // (hook returns `{ ... }` literal); using the wrapper in deps would loop.
  const { hasDraft, lastSavedAt, clearDraft } = draftStatus;
  useEffect(() => {
    if (resumeToastFiredRef.current) return;
    if (!hasDraft || !lastSavedAt) return;
    const hasContent =
      newThrowDraft.distance != null ||
      newThrowDraft.feeling !== null ||
      newThrowDraft.notes.trim() !== "";
    if (!hasContent) return;

    resumeToastFiredRef.current = true;
    showResumeToast({
      lastSavedAt,
      noun: "throw",
      onContinue: () => {
        setIsNewThrow(true);
        setSheetOpen(true);
      },
      onDiscard: async () => {
        setNewThrowDraft(EMPTY_QUICK_ENTRY_DRAFT);
        await clearDraft();
      },
    });
  }, [hasDraft, lastSavedAt, clearDraft, newThrowDraft, showResumeToast, setNewThrowDraft]);

  /* ── Formatted date ──────────────────────────────────────────────────── */

  // Format today's date on the client only. Computing it during render
  // caused hydration mismatches whenever the server's wall-clock day differed
  // from the client's (e.g. server in EDT at 00:30 AM rendering "Sunday" while
  // the client in PDT at 21:30 the prior night renders "Saturday"). Sentry
  // tracked this as PODIUM-THROWS-4 (Hydration Error) across ~16 iOS users.
  const [todayFormatted, setTodayFormatted] = useState<string>("");
  useEffect(() => {
    setTodayFormatted(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  /* ── Render ──────────────────────────────────────────────────────────── */

  const labelSlideClass = prefersReducedMotion
    ? ""
    : implementSlideDir === "left"
      ? "animate-slide-in-right"
      : "animate-slide-in-left";

  return (
    <>
      {/* Full-screen container: flex column, no scroll */}
      <div className="flex flex-col h-full select-none">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 h-12 shrink-0 border-b border-surface-700/40">
          <Link
            href="/athlete/dashboard"
            className="flex items-center gap-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-1 -ml-1 rounded-lg"
            aria-label="Back to dashboard"
          >
            <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
            <span className="text-sm">Back</span>
          </Link>

          <ConnectionChip isOnline={isOnline} pendingCount={pendingCount} isSyncing={isSyncing} />

          <Link
            href="/athlete/dashboard"
            className="text-sm font-semibold text-primary-500 hover:text-primary-400 transition-colors px-1"
          >
            Done
          </Link>
        </div>

        {/* Session info */}
        <div className="text-center px-4 py-3 shrink-0">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
            Today&apos;s Session
          </p>
          <p className="font-heading text-lg font-semibold text-[var(--foreground)] mt-0.5">
            {todayFormatted}
          </p>
          {sessionFocus && <p className="text-xs text-[var(--muted)] mt-0.5">{sessionFocus}</p>}
        </div>

        {/* Implement display (draggable) */}
        <div
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            transform: `translateX(${dragOffset}px)`,
            opacity: dragOpacity,
            // Snap-back transition runs only while NOT actively dragging.
            transition: isDraggingRef.current
              ? "none"
              : "transform 200ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease-out",
          }}
          className="text-center px-4 shrink-0 cursor-grab active:cursor-grabbing touch-pan-y"
        >
          {/* Key-based remount triggers the slide-in CSS animation on each switch */}
          <div key={implementAnimKey} className={labelSlideClass}>
            {isLoading ? (
              <div className="h-7 w-48 mx-auto rounded-lg bg-surface-700 animate-pulse" />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="font-heading text-xl font-bold text-[var(--foreground)]">
                    {currentImplement?.event ?? "—"}
                    {" · "}
                    <button
                      type="button"
                      onClick={() => setWeightPickerOpen((v) => !v)}
                      className="font-mono inline-flex items-center gap-1 text-primary-400 underline underline-offset-4 decoration-primary-400/30"
                    >
                      {currentImplement?.displayLabel ??
                        (currentImplement ? `${currentImplement.implementWeight}kg` : "—")}
                      <span className="text-nano no-underline">▾</span>
                    </button>
                  </span>
                </div>
                {/* Weight picker pills */}
                {weightPickerOpen && currentImplement && (
                  <div className="flex flex-wrap justify-center gap-1.5 mt-2 px-2">
                    {(weightPresets[currentImplement.event] ?? []).map((w) => {
                      const isActive = Math.abs(w - currentImplement.implementWeight) < 0.01;
                      const isComp =
                        Math.abs(w - (compWeights[currentImplement.event] ?? 0)) < 0.01;
                      // Catalog displayLabel for this preset, when known —
                      // shows imperial implements as "16 lb" instead of "7.26kg".
                      const presetLabel =
                        weightPresetLabels[currentImplement.event]?.find(
                          (p) => Math.abs(p.kg - w) < 0.01
                        )?.label ?? null;
                      return (
                        <button
                          key={w}
                          type="button"
                          onClick={() => changeWeight(w)}
                          className={cn(
                            "min-h-[44px] px-3 py-2 rounded-lg text-sm font-mono font-semibold transition-colors",
                            isActive
                              ? "bg-primary-500 text-surface-950"
                              : "bg-surface-800 text-surface-300 active:bg-surface-700"
                          )}
                        >
                          {presetLabel ?? `${w}kg`}
                          {isComp && !isActive && (
                            <span className="ml-1 text-nano text-primary-400 font-sans">comp</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          {implements_.length > 1 && (
            <p className="text-nano text-[var(--muted)] mt-1 tracking-wider">← swipe to switch →</p>
          )}
        </div>

        {/* Throw counter */}
        <div className="flex flex-col items-center justify-center flex-1 min-h-0 pb-2">
          {isLoading ? (
            <div className="h-32 w-36 rounded-2xl bg-surface-700 animate-pulse mx-auto" />
          ) : (
            <div
              key={throwCount}
              className={cn(
                "font-mono text-[clamp(80px,20vw,140px)] leading-none font-bold",
                "text-[var(--foreground)] tabular-nums text-center",
                !prefersReducedMotion && "animate-count-up-spring"
              )}
              aria-live="polite"
              aria-label={`${throwCount} throws`}
            >
              {throwCount}
            </div>
          )}
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mt-1">
            Throw Count
          </p>
        </div>

        {/* Big log button */}
        <div className="flex flex-col items-center gap-5 shrink-0 pb-2">
          <button
            type="button"
            aria-label="Log throw"
            style={{ touchAction: "manipulation" }}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                logThrow();
              }
            }}
            className={cn(
              "relative rounded-full flex flex-col items-center justify-center",
              "w-[clamp(200px,55vw,260px)] h-[clamp(200px,55vw,260px)]",
              "bg-gradient-to-br from-primary-400 to-primary-600",
              "shadow-warm-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/60",
              "cursor-pointer select-none transition-[transform,box-shadow] duration-200 ease-out",
              !prefersReducedMotion && "active:scale-95"
            )}
          >
            {/* Glow pulse ring after each throw */}
            {glowActive && !prefersReducedMotion && (
              <span
                key={`glow-${Date.now()}`}
                className="absolute inset-0 rounded-full bg-primary-400/30 pointer-events-none animate-glow-pulse"
                aria-hidden="true"
              />
            )}

            <span className="font-heading font-bold text-xl text-surface-950 tracking-wide select-none pointer-events-none">
              LOG THROW
            </span>
            <span className="text-nano font-semibold text-surface-800/70 uppercase tracking-widest mt-1 select-none pointer-events-none">
              Hold for details
            </span>
          </button>

          {/* Dot indicator */}
          <DotIndicator count={implements_.length} current={implementIndex} />
        </div>

        {/* Recent throws chips — bottom safe-area handled by (fullscreen)/layout.tsx */}
        <div className="shrink-0 pb-2">
          {isLoading ? (
            <div className="flex gap-3 px-5 py-3 overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-9 w-20 rounded-xl bg-surface-700 animate-pulse shrink-0"
                />
              ))}
            </div>
          ) : recentThrows.length > 0 ? (
            <div className="overflow-x-auto custom-scrollbar">
              <div className="flex gap-3 px-5 py-3">
                <span className="text-nano text-[var(--muted)] self-center shrink-0 uppercase tracking-wider">
                  Recent
                </span>
                {recentThrows.slice(0, 3).map((t, i) => (
                  <ThrowChip
                    key={t.id}
                    throw_={t}
                    index={throwCount - i - 1}
                    onTap={openEditSheet}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-[var(--muted)] py-3">
              Your recent throws will appear here
            </p>
          )}
        </div>
      </div>

      {/* Quick Entry Bottom Sheet */}
      <QuickEntrySheet
        isOpen={sheetOpen}
        editingThrow={editingThrow}
        controlled={isNewThrow ? { value: newThrowDraft, onChange: setNewThrowDraft } : undefined}
        onClose={() => {
          void handleSheetClose();
        }}
        onSave={handleSheetSave}
      />

      <PRCelebration
        show={prCelebration.show}
        onDismiss={() => setPrCelebration({ show: false })}
        event={prCelebration.event}
        distance={prCelebration.distance}
      />
    </>
  );
}
