"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PRCelebration } from "@/components/ui/PRCelebration";
import { useToast } from "@/components/ui/Toast";
import { haptic } from "@/lib/haptic";
import type { OnboardingMode } from "../_state";

interface Step5CelebrateProps {
  mode: OnboardingMode;
  hasCoach: boolean;
  /** Distance in meters (canonical), formatted via display unit at render time. */
  distanceMeters: number | null;
  /** Display unit chosen by the athlete in Step 4. */
  displayUnit: "m" | "ft";
}

/**
 * Step 5 — Celebration.
 *
 * Fires PRCelebration overlay + celebration toast + haptic.pr() on mount,
 * then auto-routes to /athlete/dashboard after 1500ms (per brief).
 *
 * The wizard's submit handler runs BEFORE this step renders — by the time
 * we land here the throw has already been logged. This component is the
 * curtain call, not the action.
 */
export function Step5Celebrate({
  mode,
  hasCoach,
  distanceMeters,
  displayUnit,
}: Step5CelebrateProps) {
  const router = useRouter();
  const toast = useToast();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const distanceLabel =
      distanceMeters != null
        ? displayUnit === "ft"
          ? `${(distanceMeters / 0.3048).toFixed(2)} ft`
          : `${distanceMeters.toFixed(2)} m`
        : null;

    haptic.pr();

    toast.celebration("You're on the board.", {
      description:
        hasCoach && mode === "invite" ? "Welcome to the team." : "You started something.",
      highlight: distanceLabel ?? undefined,
      duration: 4000,
    });

    const timer = setTimeout(() => {
      router.push("/athlete/dashboard");
    }, 1500);

    return () => clearTimeout(timer);
  }, [mode, hasCoach, distanceMeters, displayUnit, router, toast]);

  const distanceForOverlay = distanceMeters ?? undefined;
  const unitForOverlay = displayUnit;

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <PRCelebration
        show
        onDismiss={() => router.push("/athlete/dashboard")}
        title="You're on the board."
        distance={distanceForOverlay}
        unit={unitForOverlay}
      />
    </div>
  );
}
