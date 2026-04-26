"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { haptic, isEnabled, isVibrationSupported, type Haptic } from "@/lib/haptic";

/* ─── Athlete-shell detection ────────────────────────────────────────────────
   Haptics only fire inside the athlete shell. Coaches do not buzz — that
   register belongs to the consumer app, not the back-office. AthleteShell
   marks `<body>` with `athlete-shell` so the lookup works from anywhere
   (including portaled toasts and modals where the React tree is detached).
   ───────────────────────────────────────────────────────────────────────── */

function subscribeToBodyClass(callback: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function readBodyHasAthleteShell(): boolean {
  if (typeof document === "undefined") return false;
  return document.body.classList.contains("athlete-shell");
}

function readServerSnapshot(): boolean {
  return false;
}

/** True when the current page is inside the athlete shell. */
export function useIsAthleteShell(): boolean {
  return useSyncExternalStore(subscribeToBodyClass, readBodyHasAthleteShell, readServerSnapshot);
}

/* ─── useHaptic ──────────────────────────────────────────────────────────────
   Returns the haptic surface gated by:
     1. athlete-shell (no buzzes for coaches)
     2. user preference (Settings → Haptics toggle)
     3. feature support (navigator.vibrate)
     4. prefers-reduced-motion (handled inside the lib)

   `isAvailable` reflects feature + preference and is suitable for UI copy
   like "Haptics are available on your device." It does NOT include the
   shell check — that's a routing concern, not a device capability.
   ───────────────────────────────────────────────────────────────────────── */

const NOOP: Haptic = {
  light: () => {},
  medium: () => {},
  heavy: () => {},
  success: () => {},
  error: () => {},
  pr: () => {},
  streak: () => {},
};

export interface UseHapticResult extends Haptic {
  /** Device supports vibration AND user preference is on AND not reduced-motion. */
  isAvailable: boolean;
  /** Device supports the Vibration API at all (regardless of preference). */
  isSupported: boolean;
}

export function useHaptic(): UseHapticResult {
  const isAthlete = useIsAthleteShell();

  const [isSupported, setIsSupported] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setIsSupported(isVibrationSupported());
    setAvailable(isEnabled());

    function refresh() {
      setAvailable(isEnabled());
    }
    // Reflect changes from another tab or the settings toggle.
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  return useMemo<UseHapticResult>(
    () =>
      isAthlete
        ? { ...haptic, isAvailable: available, isSupported }
        : { ...NOOP, isAvailable: false, isSupported },
    [isAthlete, available, isSupported]
  );
}
