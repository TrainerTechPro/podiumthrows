"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { ChevronLeft, Loader2, X } from "lucide-react";
import { useOnlineStatus } from "@/lib/pwa/online-status";
import {
  queueQuickLogThrow,
  getPendingQuickLogCount,
  syncQuickLogQueue,
} from "@/lib/pwa/quick-log-queue";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Implement {
  event: string;
  implementWeight: number;
  label: string; // e.g. "Shot Put · 7.26kg"
}

interface RecentThrow {
  id: string; // may be temp id for optimistic entries
  event: string;
  implementWeight: number;
  distance: number | null;
  feeling: string | null;
  notes: string | null;
  isOptimistic?: boolean;
}

interface QuickLogData {
  currentImplement: { event: string; implementWeight: number } | null;
  recentThrows: RecentThrow[];
  throwCount: number;
  availableImplements: { event: string; implementWeight: number }[];
  weightPresets?: Record<string, number[]>;
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

/* ─── Haptic helper ──────────────────────────────────────────────────────── */

function haptic(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

/* ─── Build implement list from raw data ─────────────────────────────────── */

function buildImplementList(
  available: { event: string; implementWeight: number }[],
  current: { event: string; implementWeight: number } | null
): Implement[] {
  const list: Implement[] = available.map((i) => ({
    event: i.event,
    implementWeight: i.implementWeight,
    label: `${i.event} · ${i.implementWeight}kg`,
  }));

  // If no available implements, create a default from current
  if (list.length === 0 && current) {
    list.push({
      event: current.event,
      implementWeight: current.implementWeight,
      label: `${current.event} · ${current.implementWeight}kg`,
    });
  }

  // Default fallback
  if (list.length === 0) {
    list.push({ event: "Shot Put", implementWeight: 7.26, label: "Shot Put · 7.26kg" });
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
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-700/60 border border-surface-600/40 text-xs text-[var(--muted)]">
      {isSyncing && isOnline && pendingCount > 0 ? (
        <Loader2 size={10} className="animate-spin text-warning-500" aria-hidden="true" />
      ) : (
        <span className={cn("w-2 h-2 rounded-full shrink-0", dotClass)} aria-hidden="true" />
      )}
      <span className="font-mono tabular-nums whitespace-nowrap">{label}</span>
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
    throw_.feeling === "great" ? "🔥" : throw_.feeling === "bad" ? "😞" : throw_.feeling === "ok" ? "😐" : "";

  const label = throw_.distance
    ? `${throw_.distance.toFixed(2)}m${feelingEmoji ? ` ${feelingEmoji}` : ""}`
    : `#${index + 1}${feelingEmoji ? ` ${feelingEmoji}` : ""}`;

  return (
    <motion.button
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: throw_.isOptimistic ? 0.6 : 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      whileTap={{ scale: 0.93 }}
      onClick={() => onTap(throw_)}
      className="shrink-0 px-3 py-2 rounded-xl bg-surface-700/80 border border-surface-600/60 text-xs font-mono tabular-nums text-[var(--foreground)] hover:bg-surface-600/80 transition-colors active:scale-95 cursor-pointer min-w-[64px] text-center"
      aria-label={`Edit throw: ${label}`}
    >
      {label}
    </motion.button>
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
      {Array.from({ length: count }).map((_, i) => (
        <motion.span
          key={i}
          animate={{ scale: i === current ? 1 : 0.65, opacity: i === current ? 1 : 0.4 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={cn(
            "rounded-full",
            i === current
              ? "w-2.5 h-2.5 bg-primary-500"
              : "w-2 h-2 bg-surface-400"
          )}
        />
      ))}
    </div>
  );
}

/* ─── Quick Entry Bottom Sheet ───────────────────────────────────────────── */

interface QuickEntrySheetProps {
  isOpen: boolean;
  editingThrow: RecentThrow | null; // null = new throw
  onClose: () => void;
  onSave: (data: { distance: number | null; feeling: FeelingOption | null; notes: string }) => void;
}

function QuickEntrySheet({ isOpen, editingThrow, onClose, onSave }: QuickEntrySheetProps) {
  const [distance, setDistance] = useState<string>("");
  const [feeling, setFeeling] = useState<FeelingOption | null>(null);
  const [notes, setNotes] = useState<string>("");

  // Prefill when editing
  useEffect(() => {
    if (isOpen) {
      setDistance(editingThrow?.distance?.toFixed(2) ?? "");
      setFeeling((editingThrow?.feeling as FeelingOption | null) ?? null);
      setNotes(editingThrow?.notes ?? "");
    } else {
      // Reset on close
      setDistance("");
      setFeeling(null);
      setNotes("");
    }
  }, [isOpen, editingThrow]);

  const handleSave = useCallback(() => {
    const dist = distance.trim() ? parseFloat(distance.trim()) : null;
    onSave({
      distance: dist && !isNaN(dist) ? dist : null,
      feeling,
      notes: notes.trim(),
    });
  }, [distance, feeling, notes, onSave]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            key="sheet-panel"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-surface-800 rounded-t-3xl border-t border-surface-600/60 px-5 pb-safe-bottom pt-5"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            role="dialog"
            aria-label={editingThrow ? "Edit throw details" : "Add throw details"}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-surface-500 mx-auto mb-5" aria-hidden="true" />

            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-5">
              {editingThrow ? "Edit Throw" : "Add Details"}
            </p>

            {/* Distance */}
            <div className="mb-5">
              <label className="block text-xs text-[var(--muted)] mb-1.5" htmlFor="ql-distance">
                Distance (meters)
              </label>
              <div className="relative">
                <input
                  id="ql-distance"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max="100"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="—"
                  className="w-full bg-surface-700 border border-surface-600/60 rounded-xl px-4 py-3 text-lg font-mono text-[var(--foreground)] placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/60 pr-10"
                />
                {distance && (
                  <button
                    onClick={() => setDistance("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-[var(--foreground)] p-1"
                    aria-label="Clear distance"
                  >
                    <X size={14} strokeWidth={1.75} />
                  </button>
                )}
              </div>
            </div>

            {/* Feeling */}
            <div className="mb-5">
              <p className="text-xs text-[var(--muted)] mb-2.5">How did it feel?</p>
              <div className="flex gap-3">
                {(["bad", "ok", "great"] as FeelingOption[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setFeeling(feeling === opt ? null : opt)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all",
                      feeling === opt
                        ? "bg-primary-500/20 border-primary-500/60 text-primary-400"
                        : "bg-surface-700 border-surface-600/40 text-[var(--muted)] hover:border-surface-500"
                    )}
                    aria-pressed={feeling === opt}
                    aria-label={FEELING_LABELS[opt]}
                  >
                    <span className="text-2xl leading-none">{FEELING_EMOJI[opt]}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      {FEELING_LABELS[opt]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div className="mb-6">
              <label className="block text-xs text-[var(--muted)] mb-1.5" htmlFor="ql-notes">
                Note
              </label>
              <input
                id="ql-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note..."
                className="w-full bg-surface-700 border border-surface-600/60 rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/60"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSave}
                className="w-full py-4 rounded-2xl bg-primary-500 text-surface-950 font-heading font-bold text-base hover:bg-primary-400 active:scale-[0.98] transition-all"
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function QuickLogClient() {
  // Data state
  const [implements_, setImplements] = useState<Implement[]>([]);
  const [implementIndex, setImplementIndex] = useState(0);
  const [throwCount, setThrowCount] = useState(0);
  const [recentThrows, setRecentThrows] = useState<RecentThrow[]>([]);
  const [sessionFocus, setSessionFocus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Weight presets for the weight picker
  const [weightPresets, setWeightPresets] = useState<Record<string, number[]>>({});
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

  const { success: toastSuccess, error: toastError } = useToast();

  // Long-press state. We use `onClick` for the actual tap (most reliable
  // cross-browser, especially on iOS where pointerup races with framer-motion's
  // own gesture detection), and pointer events ONLY to time the long-press.
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
            if (Number.isFinite(savedWeight) && Math.abs(list[eventIndex].implementWeight - savedWeight) > 0.01) {
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
    getPendingQuickLogCount().then(setPendingCount).catch(() => {});
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
              `${synced} throw${synced !== 1 ? "s" : ""} synced, ${failed} failed — will retry next time you're online.`,
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
          toastError("Sync failed", "Couldn\u2019t sync your throws \u2014 will retry when connected.");
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
      haptic(30);
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
      haptic(30);
      // Update the current implement's weight in the list
      setImplements((prev) =>
        prev.map((impl, i) =>
          i === implementIndex ? { ...impl, implementWeight: newWeight } : impl
        )
      );
      // Persist updated selection
      localStorage.setItem(IMPLEMENT_KEY, `${currentImplement.event}|${newWeight}`);
      setWeightPickerOpen(false);
    },
    [currentImplement, implementIndex]
  );

  /* ── Log throw (immediate, no popover) ──────────────────────────────── */

  const logThrow = useCallback(
    async (opts?: { distance?: number | null; feeling?: FeelingOption | null; notes?: string }) => {
      if (!currentImplement) return;

      haptic(20);

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

      if (isOnline) {
        try {
          // AbortSignal.timeout may not exist on older iOS Safari — fallback to AbortController
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const res = await fetch("/api/athlete/quick-log", {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
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

          // Replace optimistic with real throw
          setRecentThrows((prev) =>
            prev.map((t) => (t.id === tempId ? { ...saved, isOptimistic: false } : t))
          );
          // Use authoritative count from server (fixes potential drift)
          // -1 means server couldn't count but throw WAS saved
          if (typeof newCount === "number" && newCount >= 0) setThrowCount(newCount);
        } catch (err) {
          const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
          const isAbort = err instanceof DOMException && err.name === "AbortError";

          if (isTimeout || isAbort) {
            // Treat slow connection as offline — queue for sync instead of rolling back
            const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
        const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    [currentImplement, isOnline, toastError]
  );

  /* ── Tap + long-press handlers ───────────────────────────────────────── */

  // Start the long-press timer on pointerdown. The actual tap is handled by
  // `handleClick` below — that gives us a reliable, browser-synthesized
  // tap event that fires on every platform without racing framer-motion.
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Keyboard activation (pointerType === "") must not trigger the long-press sheet
    if (e.pointerType !== "touch" && e.pointerType !== "mouse") return;
    longPressTriggered.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      haptic(50);
      setIsNewThrow(true);
      setEditingThrow(null);
      setSheetOpen(true);
    }, 500);
  }, []);

  // pointerup / pointercancel / pointerleave: just stop the long-press timer.
  // We deliberately do NOT call logThrow here — the click event handles taps.
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // The actual tap. Click fires after pointerup on the same element (mouse,
  // touch, or keyboard activation), so this is the universal "tap completed"
  // event. If the long-press already fired and opened the sheet, we suppress
  // the trailing click and reset the flag.
  const handleClick = useCallback(() => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    logThrow();
  }, [logThrow]);

  /* ── Swipe gesture (framer-motion drag) ──────────────────────────────── */

  const dragX = useMotionValue(0);
  const dragOpacity = useTransform(dragX, [-80, 0, 80], [0.7, 1, 0.7]);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number } }) => {
      const threshold = 50;
      if (info.offset.x < -threshold) {
        switchImplement("next");
      } else if (info.offset.x > threshold) {
        switchImplement("prev");
      }
      dragX.set(0);
    },
    [switchImplement, dragX]
  );

  /* ── Sheet save ──────────────────────────────────────────────────────── */

  const handleSheetSave = useCallback(
    async (data: { distance: number | null; feeling: FeelingOption | null; notes: string }) => {
      setSheetOpen(false);
      setIsNewThrow(false);
      setEditingThrow(null);

      if (isNewThrow) {
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
    [isNewThrow, editingThrow, logThrow, toastError]
  );

  /* ── Open edit sheet for a chip ─────────────────────────────────────── */

  const openEditSheet = useCallback((throw_: RecentThrow) => {
    if (throw_.isOptimistic) return;
    setIsNewThrow(false);
    setEditingThrow(throw_);
    setSheetOpen(true);
  }, []);

  /* ── Formatted date ──────────────────────────────────────────────────── */

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  /* ── Slide variants for implement label ──────────────────────────────── */

  const slideVariants = {
    enterFromLeft: { x: -40, opacity: 0 },
    enterFromRight: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exitToLeft: { x: -40, opacity: 0 },
    exitToRight: { x: 40, opacity: 0 },
  };

  /* ── Render ──────────────────────────────────────────────────────────── */

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

          <ConnectionChip
            isOnline={isOnline}
            pendingCount={pendingCount}
            isSyncing={isSyncing}
          />

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
          {sessionFocus && (
            <p className="text-xs text-[var(--muted)] mt-0.5">{sessionFocus}</p>
          )}
        </div>

        {/* Implement display (draggable) */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          style={{ x: dragX, opacity: dragOpacity }}
          className="text-center px-4 shrink-0 cursor-grab active:cursor-grabbing touch-none"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={implementAnimKey}
              variants={prefersReducedMotion ? {} : slideVariants}
              initial={implementSlideDir === "left" ? "enterFromRight" : "enterFromLeft"}
              animate="center"
              exit={implementSlideDir === "left" ? "exitToLeft" : "exitToRight"}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
            >
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
                        {currentImplement?.implementWeight ?? "—"}kg
                        <span className="text-[10px] no-underline">▾</span>
                      </button>
                    </span>
                  </div>
                  {/* Weight picker pills */}
                  {weightPickerOpen && currentImplement && (
                    <div className="flex flex-wrap justify-center gap-1.5 mt-2 px-2">
                      {(weightPresets[currentImplement.event] ?? []).map((w) => {
                        const isActive = Math.abs(w - currentImplement.implementWeight) < 0.01;
                        const isComp = Math.abs(w - (compWeights[currentImplement.event] ?? 0)) < 0.01;
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
                            {w}kg
                            {isComp && !isActive && (
                              <span className="ml-1 text-[9px] text-primary-400 font-sans">comp</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          {implements_.length > 1 && (
            <p className="text-[10px] text-[var(--muted)] mt-1 tracking-wider">
              ← swipe to switch →
            </p>
          )}
        </motion.div>

        {/* Throw counter */}
        <div className="flex flex-col items-center justify-center flex-1 min-h-0 pb-2">
          {isLoading ? (
            <div className="h-32 w-36 rounded-2xl bg-surface-700 animate-pulse mx-auto" />
          ) : (
            <motion.div
              key={throwCount}
              initial={prefersReducedMotion ? {} : { scale: 0.85, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="font-mono text-[clamp(80px,20vw,140px)] leading-none font-bold text-[var(--foreground)] tabular-nums text-center"
              aria-live="polite"
              aria-label={`${throwCount} throws`}
            >
              {throwCount}
            </motion.div>
          )}
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mt-1">
            Throw Count
          </p>
        </div>

        {/* Big log button */}
        <div className="flex flex-col items-center gap-5 shrink-0 pb-2">
          <motion.button
            type="button"
            aria-label="Log throw"
            // `manipulation` keeps clicks reliable while still disabling
            // double-tap zoom and pan-to-scroll on the button itself.
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
            whileTap={
              prefersReducedMotion
                ? {}
                : { scale: 0.95, transition: { type: "spring", stiffness: 400, damping: 25 } }
            }
            animate={
              prefersReducedMotion
                ? {}
                : { scale: 1, transition: { type: "spring", stiffness: 400, damping: 25 } }
            }
            className={cn(
              "relative rounded-full flex flex-col items-center justify-center",
              "w-[clamp(200px,55vw,260px)] h-[clamp(200px,55vw,260px)]",
              "bg-gradient-to-br from-primary-400 to-primary-600",
              "shadow-glow-lg active:shadow-glow focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/60",
              "cursor-pointer select-none transition-shadow"
            )}
          >
            {/* Glow pulse ring after each throw */}
            <AnimatePresence>
              {glowActive && !prefersReducedMotion && (
                <motion.span
                  key="glow-ring"
                  initial={{ opacity: 0.8, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.35 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full bg-primary-400/30 pointer-events-none"
                  aria-hidden="true"
                />
              )}
            </AnimatePresence>

            <span className="font-heading font-bold text-xl text-surface-950 tracking-wide select-none pointer-events-none">
              LOG THROW
            </span>
            <span className="text-[10px] font-semibold text-surface-800/70 uppercase tracking-widest mt-1 select-none pointer-events-none">
              Hold for details
            </span>
          </motion.button>

          {/* Dot indicator */}
          <DotIndicator count={implements_.length} current={implementIndex} />
        </div>

        {/* Recent throws chips — bottom safe-area handled by (fullscreen)/layout.tsx */}
        <div className="shrink-0 pb-2">
          {isLoading ? (
            <div className="flex gap-3 px-5 py-3 overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 w-20 rounded-xl bg-surface-700 animate-pulse shrink-0" />
              ))}
            </div>
          ) : recentThrows.length > 0 ? (
            <div className="overflow-x-auto custom-scrollbar">
              <div className="flex gap-3 px-5 py-3">
                <span className="text-[10px] text-[var(--muted)] self-center shrink-0 uppercase tracking-wider">
                  Recent
                </span>
                {recentThrows.slice(0, 3).map((t, i) => (
                  <ThrowChip key={t.id} throw_={t} index={throwCount - i - 1} onTap={openEditSheet} />
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
        onClose={() => {
          setSheetOpen(false);
          setIsNewThrow(false);
          setEditingThrow(null);
        }}
        onSave={handleSheetSave}
      />
    </>
  );
}
