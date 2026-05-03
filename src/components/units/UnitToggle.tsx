"use client";

/**
 * Inline unit-pref toggle.
 *
 * Two-pill segmented control next to a measurement value. Tapping the
 * inactive pill flips the user's pref for that data type — the change is
 * reflected immediately and persisted via the provider's PATCH.
 *
 *   <UnitToggle type="throwDistance" />   →  [ m ] [ ft ]
 *
 * Designed to be visually quiet — small, monochrome until interacted with.
 * Lives next to the value it controls (chart title, PR card headline)
 * rather than buried in settings, so the choice is one tap away.
 */

import { useUnitPref } from "@/lib/units/provider";
import type { UnitDataType } from "@/lib/units/types";
import { unitSuffix } from "@/lib/units/convert";
import { cn } from "@/lib/utils";

interface UnitToggleProps {
  type: UnitDataType;
  /** Optional className for the wrapper. */
  className?: string;
  /** Compact = thinner pills (use inline next to a heading). */
  size?: "compact" | "default";
}

export function UnitToggle({ type, className, size = "default" }: UnitToggleProps) {
  const { unit, setUnit } = useUnitPref(type);
  const metricLabel = unitSuffix(type, "metric");
  const imperialLabel = unitSuffix(type, "imperial");

  const padX = size === "compact" ? "px-1.5" : "px-2";
  const padY = size === "compact" ? "py-0.5" : "py-1";
  const text = size === "compact" ? "text-[10px]" : "text-xs";

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-[var(--card-border)] bg-[var(--muted-bg)] overflow-hidden",
        className
      )}
      role="group"
      aria-label="Display units"
    >
      <button
        type="button"
        onClick={() => setUnit("metric")}
        aria-pressed={unit === "metric"}
        className={cn(
          padX,
          padY,
          text,
          "font-mono uppercase tracking-wider transition-colors",
          unit === "metric"
            ? "bg-[var(--foreground)] text-[var(--background)]"
            : "text-muted hover:text-[var(--foreground)]"
        )}
      >
        {metricLabel}
      </button>
      <button
        type="button"
        onClick={() => setUnit("imperial")}
        aria-pressed={unit === "imperial"}
        className={cn(
          padX,
          padY,
          text,
          "font-mono uppercase tracking-wider transition-colors",
          unit === "imperial"
            ? "bg-[var(--foreground)] text-[var(--background)]"
            : "text-muted hover:text-[var(--foreground)]"
        )}
      >
        {imperialLabel}
      </button>
    </div>
  );
}
