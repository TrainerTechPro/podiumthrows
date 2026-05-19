"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRightLeft, Megaphone, Dumbbell, type LucideIcon } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type Mode = "COACH" | "TRAINING";

interface ModeToggleProps {
  activeMode: Mode;
  compact?: boolean;
  className?: string;
}

const MODE_CONFIG: Record<
  Mode,
  {
    Icon: LucideIcon;
    path: string;
    shortLabel: string;
    actionLabel: string;
    transitionLabel: string;
  }
> = {
  COACH: {
    Icon: Megaphone,
    path: "/coach/dashboard",
    shortLabel: "Coach",
    actionLabel: "Return to coach workspace",
    transitionLabel: "Returning to coach workspace",
  },
  TRAINING: {
    Icon: Dumbbell,
    path: "/athlete/dashboard",
    shortLabel: "Train",
    actionLabel: "Open training mode",
    transitionLabel: "Opening training mode",
  },
};

export function ModeToggle({ activeMode, compact = false, className }: ModeToggleProps) {
  const router = useRouter();
  const toast = useToast();

  const [optimisticMode, setOptimisticMode] = useState<Mode>(activeMode);
  const [switching, setSwitching] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => setOptimisticMode(activeMode), [activeMode]);

  useEffect(() => {
    const nextMode: Mode = activeMode === "COACH" ? "TRAINING" : "COACH";
    router.prefetch(MODE_CONFIG[nextMode].path);
  }, [activeMode, router]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  async function handleToggle() {
    if (switching) return;
    const previous = optimisticMode;
    const target: Mode = previous === "COACH" ? "TRAINING" : "COACH";

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
      router.push(MODE_CONFIG[target].path);
      router.refresh();
    } catch {
      setOptimisticMode(previous);
      setSwitching(false);
      toast.error("Network error — please try again.");
    }
  }

  const targetMode: Mode = optimisticMode === "COACH" ? "TRAINING" : "COACH";
  const current = MODE_CONFIG[optimisticMode];
  const target = MODE_CONFIG[targetMode];
  const TargetIcon = target.Icon;

  const iconTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };

  return (
    <>
      <button
        type="button"
        data-budge-target
        onClick={handleToggle}
        disabled={switching}
        aria-label={target.actionLabel}
        title={target.actionLabel}
        className={cn(
          "relative inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--card-border)]",
          "bg-[var(--surface-overlay)] text-[var(--foreground)] shadow-sm",
          "transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
          "disabled:cursor-not-allowed disabled:opacity-70",
          compact ? "min-w-[92px] px-2.5" : "min-w-[118px] px-3",
          className
        )}
      >
        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-primary-500 text-[var(--color-text-on-brand)]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={targetMode}
              initial={reducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reducedMotion ? { opacity: 0, scale: 1 } : { opacity: 0, scale: 0.7 }}
              transition={iconTransition}
              className="flex items-center justify-center"
            >
              <TargetIcon size={15} strokeWidth={2} aria-hidden="true" />
            </motion.span>
          </AnimatePresence>
        </span>
        <span
          className={cn(
            "leading-none",
            compact ? "text-xs font-semibold" : "text-sm font-semibold"
          )}
        >
          {switching ? "Switching…" : target.shortLabel}
        </span>
        {!compact && (
          <span className="hidden xl:inline-flex items-center text-muted">
            <ArrowRightLeft size={13} strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}
      </button>

      {switching && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-[var(--background)] px-6 text-center"
          role="status"
          aria-live="polite"
        >
          <div className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-500 text-[var(--color-text-on-brand)] shadow-sm">
              <TargetIcon size={22} strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {target.transitionLabel}
              </p>
              <p className="mt-1 text-xs text-muted">
                {current.shortLabel === "Train" ? "Training" : "Coach"} context will stay saved.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
