"use client";

/**
 * Settings → Units panel.
 *
 * Central view of every per-data-type display unit pref. The same toggles
 * appear inline next to values across the app (chart titles, PR cards) —
 * this panel is for users who want to set them all in one place.
 *
 * Reads + writes through the same UnitPrefsProvider that drives the inline
 * toggles, so changes here update the rest of the UI immediately without
 * a page refresh.
 */

import { useUnitPrefsAll } from "@/lib/units/provider";
import { UNIT_DATA_TYPES, UNIT_DATA_TYPE_LABELS, type UnitChoice } from "@/lib/units/types";
import { unitSuffix } from "@/lib/units/convert";
import { cn } from "@/lib/utils";

export function UnitsPanel() {
  const { prefs, setUnit } = useUnitPrefsAll();

  return (
    <div className="space-y-3">
      <header className="space-y-1">
        <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">Units</h2>
        <p className="text-sm text-muted">
          Choose how each kind of measurement displays. Each setting is independent — you can keep
          distance in feet while body weight stays in kilograms.
        </p>
      </header>

      <div className="card divide-y divide-[var(--card-border)]">
        {UNIT_DATA_TYPES.map((type) => {
          const current = prefs[type];
          return (
            <div key={type} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {UNIT_DATA_TYPE_LABELS[type]}
                </p>
                <p className="text-xs text-muted">
                  {current === "imperial"
                    ? `Showing in ${unitSuffix(type, "imperial")}`
                    : `Showing in ${unitSuffix(type, "metric")}`}
                </p>
              </div>
              <div
                className="inline-flex rounded-full border border-[var(--card-border)] bg-[var(--muted-bg)] overflow-hidden shrink-0"
                role="group"
                aria-label={`${UNIT_DATA_TYPE_LABELS[type]} unit`}
              >
                {(["metric", "imperial"] as UnitChoice[]).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setUnit(type, choice)}
                    aria-pressed={current === choice}
                    className={cn(
                      "px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors",
                      current === choice
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "text-muted hover:text-[var(--foreground)]"
                    )}
                  >
                    {unitSuffix(type, choice)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted">
        Implement weights (hammer, shot, plate, tire) keep their catalog name
        (&ldquo;16&nbsp;lb&rdquo;, &ldquo;7.26&nbsp;kg&rdquo;) regardless of this setting.
      </p>
    </div>
  );
}
