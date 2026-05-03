"use client";

/**
 * UnitPrefsProvider — context for per-data-type metric/imperial choice.
 *
 * Hydrated by the server-side shell from the user's profile JSON. Falls back
 * to localStorage for instant first-paint after a page transition. Updates
 * fire-and-forget a PATCH to /api/me/display-units so the choice follows
 * the user across devices.
 *
 * The provider is mounted by AthleteShell + CoachShell. Unauthenticated
 * pages get the default (all-metric) prefs without a provider.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";
import {
  DEFAULT_UNIT_PREFS,
  parseUnitPrefs,
  type UnitChoice,
  type UnitDataType,
  type UnitPrefs,
} from "./types";
import { formatBodyWeight, formatDistance, formatHeight, formatLiftingWeight } from "./convert";

const LS_KEY = "podium-display-units";

interface UnitPrefsContextValue {
  prefs: UnitPrefs;
  setUnit: (type: UnitDataType, unit: UnitChoice) => void;
}

const UnitPrefsContext = createContext<UnitPrefsContextValue>({
  prefs: DEFAULT_UNIT_PREFS,
  setUnit: () => {},
});

/**
 * Mount once per shell. `initial` comes from the server-rendered profile.
 * The provider hydrates from localStorage on mount so a route transition
 * doesn't flash the default before the server data arrives.
 */
export function UnitPrefsProvider({
  initial,
  children,
}: {
  initial?: UnitPrefs;
  children: ReactNode;
}) {
  const [prefs, setPrefs] = useState<UnitPrefs>(initial ?? DEFAULT_UNIT_PREFS);

  // Hydrate from localStorage on mount — covers same-session SPA navigations
  // where the server-rendered shell isn't re-fetched.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = parseUnitPrefs(JSON.parse(raw));
        setPrefs(parsed);
      }
    } catch {
      // ok: localStorage unavailable (Safari private mode) or corrupted —
      // server prefs already loaded, nothing actionable.
      logger.debug("UnitPrefsProvider: localStorage hydrate skipped");
    }
  }, []);

  // Whenever server prefs change (e.g. fresh shell render), prefer them
  // over a stale localStorage value.
  useEffect(() => {
    if (initial) setPrefs(initial);
  }, [initial]);

  const setUnit = useCallback((type: UnitDataType, unit: UnitChoice) => {
    setPrefs((prev) => {
      const next: UnitPrefs = { ...prev, [type]: unit };
      try {
        window.localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        // ok: best-effort cache (Safari private mode disables localStorage).
        // Server PATCH below is the source of truth; cache is a perf nicety.
        logger.debug("UnitPrefsProvider: localStorage write skipped");
      }
      // Fire-and-forget server PATCH. A failure here doesn't block the UI
      // since localStorage already holds the new value for next mount.
      void fetch("/api/me/display-units", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ [type]: unit }),
      }).catch((err) => {
        logger.error("display-units PATCH failed", { error: err });
      });
      return next;
    });
  }, []);

  const value = useMemo(() => ({ prefs, setUnit }), [prefs, setUnit]);
  return <UnitPrefsContext.Provider value={value}>{children}</UnitPrefsContext.Provider>;
}

/* ─── Hook ─────────────────────────────────────────────────────────────── */

interface UseUnitPrefResult {
  unit: UnitChoice;
  setUnit: (unit: UnitChoice) => void;
  /** Format a canonical-metric value for display per the current preference. */
  format: (value: number | null | undefined) => string;
  /** Toggle between metric and imperial. */
  toggle: () => void;
}

/** Hook: read + control one data type's display unit. */
export function useUnitPref(type: UnitDataType): UseUnitPrefResult {
  const ctx = useContext(UnitPrefsContext);
  const unit = ctx.prefs[type];

  const setUnit = useCallback((u: UnitChoice) => ctx.setUnit(type, u), [ctx, type]);
  const toggle = useCallback(
    () => ctx.setUnit(type, unit === "metric" ? "imperial" : "metric"),
    [ctx, type, unit]
  );

  const format = useCallback(
    (value: number | null | undefined): string => {
      if (value == null) return "—";
      switch (type) {
        case "distance":
          return formatDistance(value, unit);
        case "bodyWeight":
          return formatBodyWeight(value, unit);
        case "liftingWeight":
          return formatLiftingWeight(value, unit);
        case "height":
          return formatHeight(value, unit);
      }
    },
    [type, unit]
  );

  return { unit, setUnit, format, toggle };
}

/** Hook: read all prefs at once (for the Settings panel). */
export function useUnitPrefsAll(): {
  prefs: UnitPrefs;
  setUnit: (type: UnitDataType, unit: UnitChoice) => void;
} {
  return useContext(UnitPrefsContext);
}
