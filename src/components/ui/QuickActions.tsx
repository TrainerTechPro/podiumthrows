"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Plus,
  Heart,
  Target,
  Wrench,
  Play,
  Settings,
  Radio,
  ClipboardList,
  Layers,
  ScanLine,
  BookOpen,
  Trophy,
  Video,
  User,
  Users,
  FileText,
  Activity,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface QuickActionDef {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  color: string;
}

interface QuickActionsPrefs {
  enabled: boolean;
  position: "left" | "right";
  items: string[];
}

interface QuickActionsProps {
  role: "COACH" | "ATHLETE";
}

/* ─── Action Definitions ─────────────────────────────────────────────────── */

const ATHLETE_ACTIONS: QuickActionDef[] = [
  { id: "start-session", label: "Start Session", icon: Play, href: "/athlete/quick-start", color: "text-emerald-500" },
  { id: "wellness", label: "Health Check-in", icon: Heart, href: "/athlete/wellness", color: "text-rose-500" },
  { id: "log-throw", label: "Log Throw", icon: Target, href: "/athlete/throws/log", color: "text-primary-500" },
  { id: "tools", label: "Tools", icon: Wrench, href: "/athlete/tools", color: "text-blue-500" },
  { id: "codex", label: "Throws Codex", icon: BookOpen, href: "/athlete/codex", color: "text-purple-500" },
  { id: "goals", label: "Goals", icon: Trophy, href: "/athlete/goals", color: "text-amber-500" },
  { id: "videos", label: "My Videos", icon: Video, href: "/athlete/videos", color: "text-cyan-500" },
  { id: "profile", label: "Profile", icon: User, href: "/athlete/profile", color: "text-indigo-500" },
];

const COACH_ACTIONS: QuickActionDef[] = [
  { id: "practice", label: "Live Practice", icon: Radio, href: "/coach/throws/practice", color: "text-emerald-500" },
  { id: "log-session", label: "Log Session", icon: ClipboardList, href: "/coach/log-session", color: "text-primary-500" },
  { id: "builder", label: "Session Builder", icon: Layers, href: "/coach/throws/builder", color: "text-blue-500" },
  { id: "video-analysis", label: "Video Analysis", icon: ScanLine, href: "/coach/video-analysis", color: "text-purple-500" },
  { id: "roster", label: "Roster", icon: Users, href: "/coach/athletes", color: "text-cyan-500" },
  { id: "programs", label: "Programs", icon: FileText, href: "/coach/plans", color: "text-amber-500" },
  { id: "tools", label: "Tools", icon: Wrench, href: "/coach/tools", color: "text-indigo-500" },
  { id: "wellness", label: "Team Wellness", icon: Activity, href: "/coach/wellness", color: "text-rose-500" },
];

const ATHLETE_DEFAULTS = ["start-session", "wellness", "log-throw", "tools"];
const COACH_DEFAULTS = ["practice", "log-session", "builder", "video-analysis"];
const STORAGE_KEY = "podium-quick-actions";
const MAX_ITEMS = 6;

/** Paths where FAB should not appear (immersive flows) */
const EXCLUDED_PATHS = [
  "/athlete/throws/live/",
  "/coach/throws/practice/live",
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/**
 * Compute the (x, y) offset for item `index` out of `total` items,
 * arranged in a quarter-circle arc.
 *
 * Bottom-right: arc sweeps from 90° (up) → 180° (left)
 * Bottom-left:  arc sweeps from 0° (right) → 90° (up)
 */
function getItemPosition(
  index: number,
  total: number,
  position: "left" | "right",
) {
  const radius = 90;
  const startDeg = position === "right" ? 90 : 0;
  const endDeg = position === "right" ? 180 : 90;
  const deg =
    total > 1
      ? startDeg + (index * (endDeg - startDeg)) / (total - 1)
      : (startDeg + endDeg) / 2;
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: -Math.sin(rad) * radius };
}

function loadPrefs(role: string): QuickActionsPrefs {
  if (typeof window === "undefined") {
    return {
      enabled: true,
      position: "right",
      items: role === "COACH" ? COACH_DEFAULTS : ATHLETE_DEFAULTS,
    };
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${role.toLowerCase()}`);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        enabled: p.enabled ?? true,
        position: p.position === "left" ? "left" : "right",
        items: Array.isArray(p.items)
          ? p.items
          : role === "COACH"
            ? COACH_DEFAULTS
            : ATHLETE_DEFAULTS,
      };
    }
  } catch {
    /* corrupted — fall through */
  }
  return {
    enabled: true,
    position: "right",
    items: role === "COACH" ? COACH_DEFAULTS : ATHLETE_DEFAULTS,
  };
}

function savePrefs(role: string, prefs: QuickActionsPrefs) {
  try {
    localStorage.setItem(
      `${STORAGE_KEY}-${role.toLowerCase()}`,
      JSON.stringify(prefs),
    );
    window.dispatchEvent(new CustomEvent("quick-actions-prefs-change"));
  } catch {
    /* quota exceeded or private mode */
  }
}

/* ─── Customizer Panel ───────────────────────────────────────────────────── */

function CustomizerPanel({
  prefs,
  allActions,
  position,
  onChange,
  onClose,
  reduced,
}: {
  prefs: QuickActionsPrefs;
  allActions: QuickActionDef[];
  position: "left" | "right";
  onChange: (update: Partial<QuickActionsPrefs>) => void;
  onClose: () => void;
  reduced: boolean;
}) {
  const selectedSet = new Set(prefs.items);

  function toggleItem(id: string) {
    if (selectedSet.has(id)) {
      onChange({ items: prefs.items.filter((i) => i !== id) });
    } else if (prefs.items.length < MAX_ITEMS) {
      onChange({ items: [...prefs.items, id] });
    }
  }

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.85, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 20 }}
      transition={
        reduced
          ? { duration: 0.15 }
          : { type: "spring", stiffness: 400, damping: 28 }
      }
      className={cn(
        "absolute bottom-[72px] w-64",
        position === "right" ? "right-0" : "left-0",
        "card p-4 space-y-4 shadow-2xl",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold font-heading text-[var(--foreground)]">
          Quick Actions
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          aria-label="Close customizer"
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {/* Position toggle */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
          Position
        </p>
        <div className="flex gap-1">
          {(["left", "right"] as const).map((side) => (
            <button
              key={side}
              onClick={() => onChange({ position: side })}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                prefs.position === side
                  ? "bg-primary-500 text-white"
                  : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]",
              )}
            >
              {side === "left" && (
                <ChevronLeft
                  size={12}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              )}
              {side === "left" ? "Left" : "Right"}
              {side === "right" && (
                <ChevronRight
                  size={12}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Action list */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
          Actions ({prefs.items.length}/{MAX_ITEMS})
        </p>
        <div className="space-y-1 max-h-52 overflow-y-auto custom-scrollbar">
          {allActions.map((action) => {
            const isSelected = selectedSet.has(action.id);
            const isDisabled = !isSelected && prefs.items.length >= MAX_ITEMS;
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => toggleItem(action.id)}
                disabled={isDisabled}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors",
                  isSelected
                    ? "bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/30"
                    : isDisabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-surface-50 dark:hover:bg-surface-800/50 border border-transparent",
                )}
              >
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  className={cn(isSelected ? action.color : "text-muted")}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "text-xs font-medium flex-1",
                    isSelected ? "text-[var(--foreground)]" : "text-muted",
                  )}
                >
                  {action.label}
                </span>
                {isSelected && (
                  <div className="w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
                    <Check
                      size={10}
                      strokeWidth={3}
                      className="text-white"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Disable button */}
      <button
        onClick={() => onChange({ enabled: false })}
        className="w-full text-center text-[11px] text-muted hover:text-red-500 dark:hover:text-red-400 transition-colors py-1"
      >
        Disable Quick Actions
      </button>
    </motion.div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function QuickActions({ role }: QuickActionsProps) {
  const pathname = usePathname();
  const prefersReduced = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [prefs, setPrefs] = useState<QuickActionsPrefs>(() => loadPrefs(role));
  const [mounted, setMounted] = useState(false);

  // Mount guard (avoid SSR hydration mismatch for localStorage-driven state)
  useEffect(() => {
    setMounted(true);
    setPrefs(loadPrefs(role));
  }, [role]);

  // Listen for pref changes from settings page (same-tab custom event)
  useEffect(() => {
    function onPrefsChange() {
      setPrefs(loadPrefs(role));
    }
    window.addEventListener("quick-actions-prefs-change", onPrefsChange);
    return () =>
      window.removeEventListener("quick-actions-prefs-change", onPrefsChange);
  }, [role]);

  // Close menu on route change
  useEffect(() => {
    setOpen(false);
    setShowCustomizer(false);
  }, [pathname]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showCustomizer) setShowCustomizer(false);
        else setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, showCustomizer]);

  const updatePrefs = useCallback(
    (update: Partial<QuickActionsPrefs>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...update };
        savePrefs(role, next);
        return next;
      });
    },
    [role],
  );

  /* ─── Render guards ──────────────────────────────────────────────────── */

  if (!mounted) return null;
  if (EXCLUDED_PATHS.some((p) => pathname.startsWith(p))) return null;
  if (!prefs.enabled) return null;

  const allActions = role === "COACH" ? COACH_ACTIONS : ATHLETE_ACTIONS;
  const activeActions = prefs.items
    .map((id) => allActions.find((a) => a.id === id))
    .filter((a): a is QuickActionDef => a != null);

  const { position } = prefs;

  // Animation presets
  const spring = prefersReduced
    ? { duration: 0.1 }
    : { type: "spring" as const, stiffness: 400, damping: 22 };
  const springSlow = prefersReduced
    ? { duration: 0.1 }
    : { type: "spring" as const, stiffness: 400, damping: 28 };

  return (
    <>
      {/* ── Backdrop ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReduced ? 0.05 : 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9990]"
            onClick={() => {
              setOpen(false);
              setShowCustomizer(false);
            }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ── FAB Container ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed z-[9991]",
          position === "right" ? "right-5 sm:right-6" : "left-5 sm:left-6",
        )}
        style={{
          bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* ── Radial action items ───────────────────────────────────────── */}
        <AnimatePresence>
          {open &&
            !showCustomizer &&
            activeActions.map((action, index) => {
              const pos = getItemPosition(
                index,
                activeActions.length,
                position,
              );
              const Icon = action.icon;
              return (
                <motion.div
                  key={action.id}
                  className="absolute"
                  style={{ left: 6, bottom: 6 }}
                  initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    x: pos.x,
                    y: pos.y,
                  }}
                  exit={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  transition={{
                    ...spring,
                    delay: prefersReduced ? 0 : index * 0.05,
                  }}
                >
                  <div className="relative">
                    {/* Icon circle */}
                    <Link
                      href={action.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center",
                        "bg-[var(--card-bg)] border border-[var(--card-border)]",
                        "shadow-lg shadow-black/10 dark:shadow-black/30",
                        "hover:scale-110 active:scale-95 transition-transform",
                      )}
                      aria-label={action.label}
                    >
                      <Icon
                        size={20}
                        strokeWidth={1.75}
                        className={action.color}
                        aria-hidden="true"
                      />
                    </Link>

                    {/* Label pill */}
                    <span
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2",
                        "whitespace-nowrap text-[11px] font-semibold",
                        "px-2.5 py-1 rounded-lg",
                        "bg-[var(--card-bg)] border border-[var(--card-border)]",
                        "shadow-sm text-[var(--foreground)]",
                        "pointer-events-none select-none",
                        position === "right"
                          ? "right-full mr-2.5"
                          : "left-full ml-2.5",
                      )}
                    >
                      {action.label}
                    </span>
                  </div>
                </motion.div>
              );
            })}
        </AnimatePresence>

        {/* ── Customizer panel ──────────────────────────────────────────── */}
        <AnimatePresence>
          {showCustomizer && (
            <CustomizerPanel
              prefs={prefs}
              allActions={allActions}
              position={position}
              onChange={updatePrefs}
              onClose={() => setShowCustomizer(false)}
              reduced={prefersReduced}
            />
          )}
        </AnimatePresence>

        {/* ── Settings gear (visible when open) ─────────────────────────── */}
        <AnimatePresence>
          {open && (
            <motion.button
              initial={prefersReduced ? false : { opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ ...springSlow, delay: prefersReduced ? 0 : 0.15 }}
              onClick={() => setShowCustomizer((v) => !v)}
              className={cn(
                "absolute w-8 h-8 rounded-full",
                "bg-surface-200 dark:bg-surface-700",
                "flex items-center justify-center shadow-md",
                "hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors",
                position === "right"
                  ? "-left-2 bottom-1"
                  : "-right-2 bottom-1",
              )}
              aria-label="Customize quick actions"
            >
              <Settings
                size={14}
                strokeWidth={2}
                className="text-muted"
                aria-hidden="true"
              />
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Main FAB button ───────────────────────────────────────────── */}
        <motion.button
          onClick={() => {
            if (showCustomizer) {
              setShowCustomizer(false);
              return;
            }
            setOpen((v) => !v);
          }}
          className={cn(
            "relative z-10 w-14 h-14 rounded-full shadow-xl",
            "flex items-center justify-center",
            "bg-primary-500 hover:bg-primary-600 active:scale-95",
            "text-white",
            "focus:outline-none focus:ring-2 focus:ring-primary-500/50",
            "focus:ring-offset-2 focus:ring-offset-[var(--background)]",
            "transition-colors",
          )}
          aria-label={open ? "Close quick actions" : "Open quick actions"}
          aria-expanded={open}
          aria-haspopup="true"
        >
          <motion.div
            animate={{ rotate: open ? 45 : 0 }}
            transition={spring}
          >
            <Plus size={24} strokeWidth={2.5} aria-hidden="true" />
          </motion.div>
        </motion.button>
      </div>
    </>
  );
}
