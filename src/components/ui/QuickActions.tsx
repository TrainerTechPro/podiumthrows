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
  { id: "start-session", label: "Start Session", icon: Play, href: "/athlete/quick-start" },
  { id: "wellness", label: "Health Check-in", icon: Heart, href: "/athlete/wellness" },
  { id: "log-throw", label: "Log Throw", icon: Target, href: "/athlete/throws/log" },
  { id: "tools", label: "Tools", icon: Wrench, href: "/athlete/tools" },
  { id: "codex", label: "Throws Codex", icon: BookOpen, href: "/athlete/codex" },
  { id: "goals", label: "Goals", icon: Trophy, href: "/athlete/goals" },
  { id: "videos", label: "My Videos", icon: Video, href: "/athlete/videos" },
  { id: "profile", label: "Profile", icon: User, href: "/athlete/profile" },
];

const COACH_ACTIONS: QuickActionDef[] = [
  { id: "practice", label: "Live Practice", icon: Radio, href: "/coach/throws/practice" },
  { id: "log-session", label: "Log Session", icon: ClipboardList, href: "/coach/log-session" },
  { id: "builder", label: "Session Builder", icon: Layers, href: "/coach/throws/builder" },
  { id: "video-analysis", label: "Video Analysis", icon: ScanLine, href: "/coach/video-analysis" },
  { id: "roster", label: "Roster", icon: Users, href: "/coach/athletes" },
  { id: "programs", label: "Programs", icon: FileText, href: "/coach/plans" },
  { id: "tools", label: "Tools", icon: Wrench, href: "/coach/tools" },
  { id: "wellness", label: "Team Wellness", icon: Activity, href: "/coach/wellness" },
];

const ATHLETE_DEFAULTS = ["start-session", "wellness", "log-throw", "tools"];
const COACH_DEFAULTS = ["practice", "log-session", "builder", "video-analysis"];
const STORAGE_KEY = "podium-quick-actions";
const MAX_ITEMS = 6;

const EXCLUDED_PATHS = [
  "/athlete/throws/live/",
  "/coach/throws/practice/live",
];

/* ─── Sizing ─────────────────────────────────────────────────────────────── */

const FAB_SIZE = 56;
const EXPANDED_W = 234;
const ITEM_H = 52;
const FOOTER_H = 52;
const PAD_TOP = 8;
const PAD_BOTTOM = 4;

function expandedHeight(count: number) {
  return PAD_TOP + count * ITEM_H + FOOTER_H + PAD_BOTTOM;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

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
      className="fixed z-[9998] w-72 max-h-[70vh] overflow-y-auto custom-scrollbar card p-5 space-y-5 shadow-2xl"
      style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
      onClick={(e) => e.stopPropagation()}
    >
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
                  className={cn(isSelected ? "text-primary-500" : "text-muted")}
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
  const containerRef = useRef<HTMLDivElement>(null);

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

  /* ── Guards ──────────────────────────────────────────────────────────── */

  if (!mounted) return null;
  if (EXCLUDED_PATHS.some((p) => pathname.startsWith(p))) return null;
  if (!prefs.enabled) return null;

  const allActions = role === "COACH" ? COACH_ACTIONS : ATHLETE_ACTIONS;
  const activeActions = prefs.items
    .map((id) => allActions.find((a) => a.id === id))
    .filter((a): a is QuickActionDef => a != null);

  const { position } = prefs;
  const expH = expandedHeight(activeActions.length);

  /* ── Springs ─────────────────────────────────────────────────────────── */

  const containerSpring = prefersReduced
    ? { duration: 0.1 }
    : { type: "spring" as const, stiffness: 420, damping: 28 };

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
            className="fixed inset-0 bg-black/50 z-[9990]"
            onClick={() => {
              setOpen(false);
              setShowCustomizer(false);
            }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ── Morphing container ───────────────────────────────────────────── */}
      <motion.div
        ref={containerRef}
        className={cn(
          "fixed z-[9995] bg-primary-500 overflow-hidden shadow-xl shadow-primary-900/30",
          position === "right" ? "right-5 sm:right-6" : "left-5 sm:left-6",
        )}
        style={{
          bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
          willChange: "width, height, border-radius",
        }}
        animate={{
          width: open ? EXPANDED_W : FAB_SIZE,
          height: open ? expH : FAB_SIZE,
          borderRadius: open ? 22 : FAB_SIZE / 2,
        }}
        transition={containerSpring}
        aria-expanded={open}
        role="region"
        aria-label="Quick actions"
      >
        {/* ── Collapsed: + icon (always rendered, fades) ─────────────────── */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          animate={{ opacity: open ? 0 : 1, scale: open ? 0.5 : 1 }}
          transition={{ duration: 0.15 }}
        >
          <Plus
            size={24}
            strokeWidth={2.5}
            className="text-white"
            aria-hidden="true"
          />
        </motion.div>

        {/* ── Expanded content ───────────────────────────────────────────── */}
        <motion.div
          className="flex flex-col h-full"
          animate={{ opacity: open ? 1 : 0 }}
          transition={{ duration: 0.12, delay: open ? 0.1 : 0 }}
        >
          {/* Items */}
          <div className="flex-1 pt-2 pb-1">
            {activeActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <motion.div
                  key={action.id}
                  animate={{
                    opacity: open ? 1 : 0,
                    x: open ? 0 : position === "right" ? 20 : -20,
                  }}
                  transition={{
                    duration: prefersReduced ? 0.05 : 0.2,
                    delay: open ? (prefersReduced ? 0 : 0.12 + i * 0.04) : 0,
                    ease: "easeOut",
                  }}
                >
                  <Link
                    href={action.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 mx-2 px-3 py-2.5 rounded-2xl hover:bg-white/[0.12] active:bg-white/[0.18] active:scale-[0.98] transition-all duration-150"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/[0.15] flex items-center justify-center shrink-0">
                      <Icon
                        size={18}
                        strokeWidth={1.75}
                        className="text-white"
                        aria-hidden="true"
                      />
                    </div>
                    <span className="text-[13px] font-semibold text-white">
                      {action.label}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Footer: customize + close */}
          <motion.div
            className="flex items-center justify-between px-4 h-[52px] border-t border-white/[0.12]"
            animate={{ opacity: open ? 1 : 0 }}
            transition={{
              duration: 0.15,
              delay: open ? (prefersReduced ? 0 : 0.2) : 0,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCustomizer(true);
              }}
              className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors"
              aria-label="Customize quick actions"
            >
              <Settings
                size={13}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="text-[11px] font-medium">Customize</span>
            </button>

            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.12] transition-colors"
              aria-label="Close quick actions"
            >
              <X size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </motion.div>
        </motion.div>

        {/* ── Click target when collapsed ─────────────────────────────────── */}
        {!open && (
          <button
            className="absolute inset-0 w-full h-full cursor-pointer"
            onClick={() => setOpen(true)}
            aria-label="Open quick actions"
          />
        )}
      </motion.div>

      {/* ── Customizer modal ─────────────────────────────────────────────── */}
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
    </>
  );
}
