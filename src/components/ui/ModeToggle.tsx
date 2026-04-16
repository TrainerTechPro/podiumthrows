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

/* The button always shows the CURRENT mode's icon. Tapping switches to
   the other mode — the icon morphs (crossfade + scale) as the switch
   happens, which is the entire affordance. Matches the 44x44 chrome
   of the other header icons so it sits politely in a crowded bar. */
const MODE_CONFIG: Record<Mode, { Icon: LucideIcon; path: string; nextLabel: string }> = {
  COACH: {
    Icon: Megaphone,
    path: "/coach/dashboard",
    nextLabel: "Switch to Training mode",
  },
  TRAINING: {
    Icon: Dumbbell,
    path: "/athlete/dashboard",
    nextLabel: "Switch to Coach mode",
  },
};

export function ModeToggle({ activeMode, className }: ModeToggleProps) {
  const router = useRouter();
  const toast = useToast();

  // Optimistic state — icon morph starts immediately on tap, before the
  // server roundtrip. Server confirms and soft-navigates; on failure we
  // revert and surface a toast.
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

  const { Icon, nextLabel } = MODE_CONFIG[optimisticMode];

  const iconTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={switching}
      aria-label={nextLabel}
      title={nextLabel}
      className={cn(
        "relative flex items-center justify-center h-11 w-11 rounded-full",
        "bg-[var(--gold)] text-surface-950",
        "transition-transform duration-150 active:scale-[0.94] hover:scale-[1.04]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        "disabled:cursor-not-allowed disabled:opacity-70",
        className
      )}
      style={{ boxShadow: "0 0 14px rgba(255, 200, 0, 0.35)" }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={optimisticMode}
          initial={reducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? { opacity: 0, scale: 1 } : { opacity: 0, scale: 0.6 }}
          transition={iconTransition}
          className="flex items-center justify-center"
        >
          <Icon size={20} strokeWidth={2} aria-hidden="true" />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
