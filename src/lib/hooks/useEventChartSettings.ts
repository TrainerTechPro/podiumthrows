"use client";

import { useEffect, useState, useCallback } from "react";
import { logger } from "@/lib/logger";

export type DateRangeKey = "30d" | "3mo" | "6mo" | "1y" | "all";

export interface EventChartSettings {
  dateRange: DateRangeKey;
  /** List of implement labels that are currently visible (e.g. ["7.26kg", "6kg"]) */
  visibleWeights: string[];
}

/**
 * Persisted per-athlete, per-event chart settings for the throws analysis page.
 *
 * Storage key: `podiumThrows:analysisSettings:{athleteId}:{event}`
 *
 * Default when no stored value exists: `{ dateRange: "6mo", visibleWeights: [compLabel] }`.
 * The caller provides the comp-weight label since it depends on gender + event lookup.
 *
 * SSR-safe: returns defaults on first render, hydrates from localStorage in useEffect
 * to avoid hydration-mismatch warnings.
 */
export function useEventChartSettings(
  athleteId: string | null,
  event: string,
  defaultCompLabel: string | null
) {
  // Lazy initializer so the initial state is computed once per mount, not on every render
  const [settings, setSettings] = useState<EventChartSettings>(() => ({
    dateRange: "6mo",
    visibleWeights: defaultCompLabel ? [defaultCompLabel] : [],
  }));
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount. Defaults are computed inside the effect
  // so the hook picks up late-resolving `defaultCompLabel` values correctly.
  useEffect(() => {
    if (typeof window === "undefined" || !athleteId) return;
    const key = `podiumThrows:analysisSettings:${athleteId}:${event}`;
    const defaultDateRange: DateRangeKey = "6mo";
    const defaultWeights = defaultCompLabel ? [defaultCompLabel] : [];
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<EventChartSettings>;
        setSettings({
          dateRange: parsed.dateRange ?? defaultDateRange,
          visibleWeights: Array.isArray(parsed.visibleWeights)
            ? parsed.visibleWeights
            : defaultWeights,
        });
      } else {
        // No stored settings — ensure state matches computed defaults (not stale first-render value)
        setSettings({ dateRange: defaultDateRange, visibleWeights: defaultWeights });
      }
    } catch (err) {
      // Malformed JSON or disabled storage — fall through to defaults
      logger.debug("Malformed JSON or disabled storage — fall through to defaults", {
        context: "src/lib/hooks/useEventChartSettings.ts",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
    setHydrated(true);
  }, [athleteId, event, defaultCompLabel]);

  // Persist on change (only after hydration to avoid overwriting with defaults)
  useEffect(() => {
    if (!hydrated || typeof window === "undefined" || !athleteId) return;
    const key = `podiumThrows:analysisSettings:${athleteId}:${event}`;
    try {
      window.localStorage.setItem(key, JSON.stringify(settings));
    } catch (err) {
      // Quota exceeded or disabled — ignore silently; settings still work for the session
      logger.debug(
        "Quota exceeded or disabled — ignore silently; settings still work for the session",
        {
          context: "src/lib/hooks/useEventChartSettings.ts",
          metadata: { reason: err instanceof Error ? err.message : "unknown" },
        }
      );
    }
  }, [settings, hydrated, athleteId, event]);

  const setDateRange = useCallback((dateRange: DateRangeKey) => {
    setSettings((prev) => ({ ...prev, dateRange }));
  }, []);

  const toggleWeight = useCallback((label: string) => {
    setSettings((prev) => {
      const has = prev.visibleWeights.includes(label);
      return {
        ...prev,
        visibleWeights: has
          ? prev.visibleWeights.filter((w) => w !== label)
          : [...prev.visibleWeights, label],
      };
    });
  }, []);

  const resetToComp = useCallback(() => {
    setSettings({
      dateRange: "6mo",
      visibleWeights: defaultCompLabel ? [defaultCompLabel] : [],
    });
  }, [defaultCompLabel]);

  return { settings, setDateRange, toggleWeight, resetToComp };
}

/**
 * Returns the earliest date (as ISO YYYY-MM-DD) that falls within the given range,
 * relative to today. "all" returns null (no lower bound).
 */
export function rangeStartDate(range: DateRangeKey): string | null {
  if (range === "all") return null;
  const now = new Date();
  const days = range === "30d" ? 30 : range === "3mo" ? 90 : range === "6mo" ? 180 : 365;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return start.toISOString().split("T")[0];
}

export const DATE_RANGE_LABELS: Record<DateRangeKey, string> = {
  "30d": "30 days",
  "3mo": "3 months",
  "6mo": "6 months",
  "1y": "1 year",
  all: "All time",
};
