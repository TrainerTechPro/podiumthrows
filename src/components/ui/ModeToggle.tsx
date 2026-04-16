"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Megaphone, Dumbbell, type LucideIcon } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type Mode = "COACH" | "TRAINING";

interface ModeToggleProps {
  activeMode: Mode;
  className?: string;
}

const MODES: { value: Mode; label: string; path: string; Icon: LucideIcon }[] = [
  { value: "COACH", label: "Coach mode", path: "/coach/dashboard", Icon: Megaphone },
  { value: "TRAINING", label: "Training mode", path: "/athlete/dashboard", Icon: Dumbbell },
];

/* Geometry — tuned once, referenced everywhere so the thumb, click cells,
   and dim background icons stay aligned. */
const CELL = 44; // button hit size (w-11 h-11)
const THUMB = 36; // raised amber pill size (w-9 h-9)
const INSET = (CELL - THUMB) / 2; // 4px padding inside the track

export function ModeToggle({ activeMode, className }: ModeToggleProps) {
  const router = useRouter();
  const toast = useToast();

  // Optimistic state — snaps to the target the moment the user clicks so the
  // thumb slide feels instant. Server nav happens in the background; we revert
  // if the mode PUT fails.
  const [optimisticMode, setOptimisticMode] = useState<Mode>(activeMode);
  const [switching, setSwitching] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => setOptimisticMode(activeMode), [activeMode]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  async function switchTo(target: Mode) {
    if (switching || target === optimisticMode) return;
    const previous = optimisticMode;
    const targetMode = MODES.find((m) => m.value === target);
    if (!targetMode) return;

    setOptimisticMode(target);
    setSwitching(true);

    try {
      const res = await fetch("/api/user/mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ mode: target }),
      });
      if (!res.ok) {
        setOptimisticMode(previous);
        setSwitching(false);
        toast.error("Couldn't switch modes — please try again.");
        return;
      }
      // Soft nav (App Router) instead of window.location reload.
      router.push(targetMode.path);
      router.refresh();
    } catch {
      setOptimisticMode(previous);
      setSwitching(false);
      toast.error("Network error — please try again.");
    }
  }

  const activeIndex = optimisticMode === "COACH" ? 0 : 1;
  const ActiveIcon = MODES[activeIndex].Icon;

  const springTransition = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 500, damping: 32, mass: 0.7 };

  const iconTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };

  return (
    <div
      role="radiogroup"
      aria-label="Workspace mode"
      className={cn(
        "relative inline-flex items-center rounded-full bg-[var(--card-bg)] neo-inset",
        className
      )}
      style={{ height: CELL, width: CELL * 2 }}
    >
      {/* Dim positional icons — sit below the thumb. The one under the thumb
          is covered by the opaque amber pill; the other reads as the "go
          here" affordance. */}
      <div className="absolute inset-0 flex pointer-events-none" aria-hidden="true">
        {MODES.map(({ value, Icon }) => (
          <div
            key={value}
            className={cn(
              "flex items-center justify-center transition-colors duration-200",
              value === optimisticMode
                ? "text-transparent"
                : "text-surface-400 dark:text-surface-300"
            )}
            style={{ width: CELL, height: CELL }}
          >
            <Icon size={18} strokeWidth={1.75} />
          </div>
        ))}
      </div>

      {/* Sliding amber thumb — neomorphic raised + soft gold glow. Rides the
          optimistic state, not the prop. */}
      <motion.div
        aria-hidden="true"
        className="absolute rounded-full bg-[var(--gold)] flex items-center justify-center"
        style={{
          width: THUMB,
          height: THUMB,
          top: INSET,
          left: INSET,
          boxShadow: "var(--neo-raised-sm), var(--neo-glow-primary-strong)",
        }}
        animate={{ x: activeIndex * CELL }}
        transition={springTransition}
      >
        {/* Crossfade + scale on mode change — supports the slide without
            upstaging it. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={optimisticMode}
            initial={reducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducedMotion ? { opacity: 0, scale: 1 } : { opacity: 0, scale: 0.7 }}
            transition={iconTransition}
            className="text-surface-950 flex items-center justify-center"
          >
            <ActiveIcon size={18} strokeWidth={2.25} />
          </motion.span>
        </AnimatePresence>
      </motion.div>

      {/* Transparent hit surfaces — real interactive elements for the
          radiogroup. The icons above are decorative. */}
      <div className="relative z-10 flex h-full w-full">
        {MODES.map((m) => {
          const isActive = m.value === optimisticMode;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={m.label}
              title={m.label}
              disabled={switching}
              onClick={() => switchTo(m.value)}
              className={cn(
                "flex-1 rounded-full",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                "disabled:cursor-not-allowed"
              )}
              style={{ height: CELL }}
            />
          );
        })}
      </div>
    </div>
  );
}
