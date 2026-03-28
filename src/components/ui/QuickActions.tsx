"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  { id: "start-session", label: "Start Session", icon: Play, href: "/athlete/quick-start", color: "text-emerald-400" },
  { id: "wellness", label: "Health Check-in", icon: Heart, href: "/athlete/wellness", color: "text-rose-400" },
  { id: "log-throw", label: "Log Throw", icon: Target, href: "/athlete/throws/log", color: "text-amber-300" },
  { id: "tools", label: "Tools", icon: Wrench, href: "/athlete/tools", color: "text-blue-400" },
  { id: "codex", label: "Throws Codex", icon: BookOpen, href: "/athlete/codex", color: "text-purple-400" },
  { id: "goals", label: "Goals", icon: Trophy, href: "/athlete/goals", color: "text-amber-400" },
  { id: "videos", label: "My Videos", icon: Video, href: "/athlete/videos", color: "text-cyan-400" },
  { id: "profile", label: "Profile", icon: User, href: "/athlete/profile", color: "text-indigo-400" },
];

const COACH_ACTIONS: QuickActionDef[] = [
  { id: "practice", label: "Live Practice", icon: Radio, href: "/coach/throws/practice", color: "text-emerald-400" },
  { id: "log-session", label: "Log Session", icon: ClipboardList, href: "/coach/log-session", color: "text-amber-300" },
  { id: "builder", label: "Session Builder", icon: Layers, href: "/coach/throws/builder", color: "text-blue-400" },
  { id: "video-analysis", label: "Video Analysis", icon: ScanLine, href: "/coach/video-analysis", color: "text-purple-400" },
  { id: "roster", label: "Roster", icon: Users, href: "/coach/athletes", color: "text-cyan-400" },
  { id: "programs", label: "Programs", icon: FileText, href: "/coach/plans", color: "text-amber-400" },
  { id: "tools", label: "Tools", icon: Wrench, href: "/coach/tools", color: "text-indigo-400" },
  { id: "wellness", label: "Team Wellness", icon: Activity, href: "/coach/wellness", color: "text-rose-400" },
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

/**
 * Anchor point — bottom-third of viewport.
 * Items radiate from here so the menu feels reachable on mobile.
 */
const ANCHOR_Y_PERCENT = 0.6;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/** Full-circle distribution starting from the top (−90°). */
function getItemPosition(index: number, total: number) {
  const radius = 110;
  const angleDeg = (360 / total) * index - 90;
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.cos(angleRad) * radius,
    y: Math.sin(angleRad) * radius,
  };
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
    /* corrupted */
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
    /* quota / private */
  }
}

/* ─── Customizer Panel ───────────────────────────────────────────────────── */

function CustomizerPanel({
  prefs,
  allActions,
  onChange,
  onClose,
  reduced,
}: {
  prefs: QuickActionsPrefs;
  allActions: QuickActionDef[];
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
      initial={reduced ? false : { opacity: 0, scale: 0.9, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 30 }}
      transition={
        reduced
          ? { duration: 0.15 }
          : { type: "spring", stiffness: 400, damping: 28 }
      }
      className="fixed z-[9996] w-72 max-h-[70vh] overflow-y-auto custom-scrollbar card p-5 space-y-5 shadow-2xl"
      style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
      onClick={(e) => e.stopPropagation()}
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

      {/* Position */}
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
              {side === "left" && <ChevronLeft size={12} strokeWidth={2} aria-hidden="true" />}
              {side === "left" ? "Left" : "Right"}
              {side === "right" && <ChevronRight size={12} strokeWidth={2} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
          Actions ({prefs.items.length}/{MAX_ITEMS})
        </p>
        <div className="space-y-1">
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
                <span className={cn("text-xs font-medium flex-1", isSelected ? "text-[var(--foreground)]" : "text-muted")}>
                  {action.label}
                </span>
                {isSelected && (
                  <div className="w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
                    <Check size={10} strokeWidth={3} className="text-white" aria-hidden="true" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [delta, setDelta] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
    setPrefs(loadPrefs(role));
  }, [role]);

  useEffect(() => {
    function onPrefsChange() {
      setPrefs(loadPrefs(role));
    }
    window.addEventListener("quick-actions-prefs-change", onPrefsChange);
    return () =>
      window.removeEventListener("quick-actions-prefs-change", onPrefsChange);
  }, [role]);

  useEffect(() => {
    setOpen(false);
    setShowCustomizer(false);
  }, [pathname]);

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

  function handleToggle() {
    if (showCustomizer) {
      setShowCustomizer(false);
      return;
    }
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const targetX = window.innerWidth / 2;
      const targetY = window.innerHeight * ANCHOR_Y_PERCENT;
      setDelta({
        x: targetX - rect.left - rect.width / 2,
        y: targetY - rect.top - rect.height / 2,
      });
    }
    setOpen((v) => !v);
  }

  /* ── Guards ──────────────────────────────────────────────────────────── */

  if (!mounted) return null;
  if (EXCLUDED_PATHS.some((p) => pathname.startsWith(p))) return null;
  if (!prefs.enabled) return null;

  const allActions = role === "COACH" ? COACH_ACTIONS : ATHLETE_ACTIONS;
  const activeActions = prefs.items
    .map((id) => allActions.find((a) => a.id === id))
    .filter((a): a is QuickActionDef => a != null);

  const { position } = prefs;

  /* ── Animation presets ───────────────────────────────────────────────── */

  // GPU-only properties: transform + opacity.  No filter, no blur.
  const btnSpring = prefersReduced
    ? { duration: 0.05 }
    : { type: "spring" as const, stiffness: 380, damping: 26 };
  const itemSpring = prefersReduced
    ? { duration: 0.05 }
    : { type: "spring" as const, stiffness: 320, damping: 22 };

  /** Anchor point expressed as CSS top% for absolutely-positioned children. */
  const anchorTop = `${ANCHOR_Y_PERCENT * 100}%`;

  return (
    <>
      {/* ── Backdrop (no blur — pure opacity for perf) ──────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReduced ? 0.05 : 0.2 }}
            className="fixed inset-0 bg-black/70 z-[9990]"
            onClick={() => {
              setOpen(false);
              setShowCustomizer(false);
            }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ── Items (single layer, GPU-composited) ────────────────────────── */}
      <AnimatePresence>
        {open &&
          !showCustomizer &&
          activeActions.map((action, i) => {
            const pos = getItemPosition(i, activeActions.length);
            const Icon = action.icon;
            const isAbove = pos.y <= 0;
            return (
              <motion.div
                key={action.id}
                className="fixed z-[9992] pointer-events-auto"
                style={{
                  top: anchorTop,
                  left: "50%",
                  marginLeft: -28,
                  marginTop: -28,
                  width: 56,
                  height: 56,
                  willChange: "transform, opacity",
                }}
                initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                animate={{ x: pos.x, y: pos.y, scale: 1, opacity: 1 }}
                exit={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                transition={{
                  ...itemSpring,
                  delay: prefersReduced ? 0 : 0.04 + i * 0.055,
                }}
              >
                <Link
                  href={action.href}
                  onClick={() => setOpen(false)}
                  className="w-14 h-14 rounded-full bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/30 hover:brightness-110 active:scale-90 transition-[transform,filter] duration-150"
                  aria-label={action.label}
                >
                  <Icon
                    size={22}
                    strokeWidth={1.75}
                    className="text-white"
                    aria-hidden="true"
                  />
                </Link>

                <motion.span
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2",
                    "whitespace-nowrap text-[11px] font-semibold text-white/90",
                    "pointer-events-none select-none",
                    isAbove ? "top-full mt-2.5" : "bottom-full mb-2.5",
                  )}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    delay: prefersReduced ? 0 : 0.2 + i * 0.04,
                    duration: 0.15,
                  }}
                >
                  {action.label}
                </motion.span>
              </motion.div>
            );
          })}
      </AnimatePresence>

      {/* ── Settings gear ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && !showCustomizer && (
          <motion.button
            className="fixed z-[9992] pointer-events-auto w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            style={{
              top: anchorTop,
              left: "50%",
              marginLeft: -18,
              marginTop: 42,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setShowCustomizer(true);
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ ...btnSpring, delay: prefersReduced ? 0 : 0.25 }}
            aria-label="Customize quick actions"
          >
            <Settings
              size={15}
              strokeWidth={1.75}
              className="text-white/60"
              aria-hidden="true"
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Customizer panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && showCustomizer && (
          <CustomizerPanel
            prefs={prefs}
            allActions={allActions}
            onChange={updatePrefs}
            onClose={() => setShowCustomizer(false)}
            reduced={prefersReduced}
          />
        )}
      </AnimatePresence>

      {/* ── FAB button (springs corner → bottom-third center) ────────────── */}
      <motion.button
        ref={buttonRef}
        onClick={handleToggle}
        animate={
          open
            ? { x: delta.x, y: delta.y, scale: 1.14 }
            : { x: 0, y: 0, scale: 1 }
        }
        transition={btnSpring}
        style={{
          bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
          willChange: "transform",
        }}
        className={cn(
          "fixed z-[9995] w-14 h-14 rounded-full",
          "flex items-center justify-center",
          "bg-primary-500 text-white shadow-xl shadow-primary-500/25",
          "hover:bg-primary-600 active:scale-95",
          "focus:outline-none focus:ring-2 focus:ring-primary-500/50",
          "focus:ring-offset-2 focus:ring-offset-[var(--background)]",
          "transition-colors",
          position === "right" ? "right-5 sm:right-6" : "left-5 sm:left-6",
        )}
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={btnSpring}
        >
          <Plus size={24} strokeWidth={2.5} aria-hidden="true" />
        </motion.div>
      </motion.button>
    </>
  );
}
