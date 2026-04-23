"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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

/* ─── Action Definitions ─────────────────────────────────────────────────── */

const ATHLETE_ACTIONS: QuickActionDef[] = [
  {
    id: "start-session",
    label: "Start Session",
    icon: Play,
    href: "/athlete/quick-start",
    color: "text-emerald-500",
  },
  {
    id: "wellness",
    label: "Health Check-in",
    icon: Heart,
    href: "/athlete/wellness",
    color: "text-rose-500",
  },
  {
    id: "log-throw",
    label: "Log Throw",
    icon: Target,
    href: "/athlete/throws/log",
    color: "text-primary-500",
  },
  { id: "tools", label: "Tools", icon: Wrench, href: "/athlete/tools", color: "text-blue-500" },
  {
    id: "codex",
    label: "Throws Codex",
    icon: BookOpen,
    href: "/athlete/codex",
    color: "text-purple-500",
  },
  { id: "goals", label: "Goals", icon: Trophy, href: "/athlete/goals", color: "text-amber-500" },
  {
    id: "videos",
    label: "My Videos",
    icon: Video,
    href: "/athlete/videos",
    color: "text-cyan-500",
  },
  {
    id: "profile",
    label: "Profile",
    icon: User,
    href: "/athlete/profile",
    color: "text-indigo-500",
  },
];

const COACH_ACTIONS: QuickActionDef[] = [
  {
    id: "practice",
    label: "Live Practice",
    icon: Radio,
    href: "/coach/throws/practice",
    color: "text-emerald-500",
  },
  {
    id: "log-session",
    label: "Log Session",
    icon: ClipboardList,
    href: "/coach/log-session",
    color: "text-primary-500",
  },
  {
    id: "builder",
    label: "Session Builder",
    icon: Layers,
    href: "/coach/throws/builder",
    color: "text-blue-500",
  },
  {
    id: "video-analysis",
    label: "Pose Analysis",
    icon: ScanLine,
    href: "/coach/video-analysis",
    color: "text-purple-500",
  },
  { id: "roster", label: "Roster", icon: Users, href: "/coach/athletes", color: "text-cyan-500" },
  {
    id: "programs",
    label: "Programs",
    icon: FileText,
    href: "/coach/plans",
    color: "text-amber-500",
  },
  { id: "tools", label: "Tools", icon: Wrench, href: "/coach/tools", color: "text-indigo-500" },
  {
    id: "wellness",
    label: "Team Wellness",
    icon: Activity,
    href: "/coach/wellness",
    color: "text-rose-500",
  },
];

const ATHLETE_DEFAULTS = ["start-session", "wellness", "log-throw", "tools"];
const COACH_DEFAULTS = ["practice", "log-session", "builder", "video-analysis"];
const STORAGE_KEY = "podium-quick-actions";
const MAX_ITEMS = 6;

const LIVE_THROWS_PATH_RE = /^\/athlete\/throws\/[^/]+$/;
const EXCLUDED_PATH_PREFIXES = ["/coach/throws/practice/live"];

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
    localStorage.setItem(`${STORAGE_KEY}-${role.toLowerCase()}`, JSON.stringify(prefs));
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
      transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 400, damping: 28 }}
      className="w-72 max-h-[70vh] overflow-y-auto custom-scrollbar card p-5 space-y-5 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold font-heading text-[var(--foreground)]">Quick Actions</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          aria-label="Close customizer"
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Position</p>
        <div className="flex gap-1">
          {(["left", "right"] as const).map((side) => (
            <button
              key={side}
              onClick={() => onChange({ position: side })}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                prefs.position === side
                  ? "bg-primary-500 text-white"
                  : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
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
                      : "hover:bg-surface-50 dark:hover:bg-surface-800/50 border border-transparent"
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
                    isSelected ? "text-[var(--foreground)]" : "text-muted"
                  )}
                >
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

export function QuickActions({ role }: { role: "COACH" | "ATHLETE" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefersReduced = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [prefs, setPrefs] = useState<QuickActionsPrefs>(() => loadPrefs(role));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPrefs(loadPrefs(role));
  }, [role]);

  useEffect(() => {
    function h() {
      setPrefs(loadPrefs(role));
    }
    window.addEventListener("quick-actions-prefs-change", h);
    return () => window.removeEventListener("quick-actions-prefs-change", h);
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
    [role]
  );

  if (!mounted) return null;
  const isLiveThrows = LIVE_THROWS_PATH_RE.test(pathname) && searchParams.get("view") === "live";
  if (isLiveThrows) return null;
  if (EXCLUDED_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (!prefs.enabled) return null;

  const allActions = role === "COACH" ? COACH_ACTIONS : ATHLETE_ACTIONS;
  const activeActions = prefs.items
    .map((id) => allActions.find((a) => a.id === id))
    .filter((a): a is QuickActionDef => a != null);

  const { position } = prefs;

  const panelSpring = prefersReduced
    ? { duration: 0.1 }
    : { type: "spring" as const, stiffness: 440, damping: 26 };

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
            className="fixed inset-0 bg-black/40 z-[9990]"
            onClick={() => {
              setOpen(false);
              setShowCustomizer(false);
            }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ── Panel (springs from FAB corner using scale — GPU only) ────── */}
      <AnimatePresence>
        {open && !showCustomizer && (
          <motion.div
            className={cn(
              "fixed z-[9994] w-[240px] rounded-2xl overflow-hidden",
              "bg-white dark:bg-surface-900",
              "border border-surface-200 dark:border-surface-700/60",
              "shadow-2xl shadow-black/20 dark:shadow-black/50",
              position === "right" ? "right-5 sm:right-6" : "left-5 sm:left-6"
            )}
            style={{
              bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
              transformOrigin: position === "right" ? "bottom right" : "bottom left",
            }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={panelSpring}
          >
            {/* Items */}
            <div className="py-2">
              {activeActions.map((action, i) => {
                const Icon = action.icon;
                return (
                  <motion.div
                    key={action.id}
                    initial={{
                      opacity: 0,
                      x: position === "right" ? 14 : -14,
                    }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: prefersReduced ? 0.05 : 0.2,
                      delay: prefersReduced ? 0 : 0.06 + i * 0.04,
                      ease: "easeOut",
                    }}
                  >
                    <Link
                      href={action.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 mx-1.5 px-3 py-2.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/60 active:scale-[0.98] transition-all duration-150"
                    >
                      <div className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center shrink-0">
                        <Icon
                          size={18}
                          strokeWidth={1.75}
                          className={action.color}
                          aria-hidden="true"
                        />
                      </div>
                      <span className="text-[13px] font-semibold text-[var(--foreground)]">
                        {action.label}
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center px-4 py-2.5 border-t border-surface-200 dark:border-surface-700/60">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCustomizer(true);
                }}
                className="flex items-center gap-1.5 text-muted hover:text-[var(--foreground)] transition-colors"
                aria-label="Customize quick actions"
              >
                <Settings size={13} strokeWidth={1.75} aria-hidden="true" />
                <span className="text-[11px] font-medium">Customize</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Customizer modal (flex-centered wrapper avoids transform conflicts) */}
      <AnimatePresence>
        {open && showCustomizer && (
          <div
            className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
            onClick={() => setShowCustomizer(false)}
          >
            <CustomizerPanel
              prefs={prefs}
              allActions={allActions}
              onChange={updatePrefs}
              onClose={() => setShowCustomizer(false)}
              reduced={prefersReduced}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── FAB button (stays in place, icon rotates) ────────────────────── */}
      <button
        onClick={() => {
          if (showCustomizer) {
            setShowCustomizer(false);
            return;
          }
          setOpen((v) => !v);
        }}
        className={cn(
          "fixed z-[9995] w-14 h-14 rounded-full",
          "flex items-center justify-center",
          "bg-primary-500 hover:bg-primary-600 active:scale-95",
          "text-white shadow-xl shadow-primary-500/25",
          "focus:outline-none focus:ring-2 focus:ring-primary-500/50",
          "focus:ring-offset-2 focus:ring-offset-[var(--background)]",
          "transition-all duration-150",
          position === "right" ? "right-5 sm:right-6" : "left-5 sm:left-6"
        )}
        style={{
          bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
        }}
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={
            prefersReduced ? { duration: 0.05 } : { type: "spring", stiffness: 400, damping: 22 }
          }
        >
          <Plus size={24} strokeWidth={2.5} aria-hidden="true" />
        </motion.div>
      </button>
    </>
  );
}
