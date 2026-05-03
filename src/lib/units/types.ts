/**
 * Per-data-type display unit preferences.
 *
 * Server stores everything in canonical metric (meters / kilograms /
 * centimeters). The user picks how to *see* each data type independently —
 * a coach can keep distance in feet while body weight stays in kg.
 *
 * Implement weights are NOT in this list — they're rendered via the
 * Implement catalog's per-row primaryUnit. See seed-implements.ts.
 */
export type UnitChoice = "metric" | "imperial";

export type UnitDataType = "distance" | "bodyWeight" | "liftingWeight" | "height";

export type UnitPrefs = Record<UnitDataType, UnitChoice>;

export const DEFAULT_UNIT_PREFS: UnitPrefs = {
  distance: "metric",
  bodyWeight: "metric",
  liftingWeight: "metric",
  height: "metric",
};

export const UNIT_DATA_TYPES: UnitDataType[] = [
  "distance",
  "bodyWeight",
  "liftingWeight",
  "height",
];

export const UNIT_DATA_TYPE_LABELS: Record<UnitDataType, string> = {
  distance: "Distance",
  bodyWeight: "Body weight",
  liftingWeight: "Lifting weight",
  height: "Height",
};

/**
 * Parse a free-form prefs JSON value (from Prisma) into a strict UnitPrefs
 * with defaults filled in. Any unknown shape collapses to all-metric.
 */
export function parseUnitPrefs(raw: unknown): UnitPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_UNIT_PREFS };
  const obj = raw as Record<string, unknown>;
  const get = (key: UnitDataType): UnitChoice => (obj[key] === "imperial" ? "imperial" : "metric");
  return {
    distance: get("distance"),
    bodyWeight: get("bodyWeight"),
    liftingWeight: get("liftingWeight"),
    height: get("height"),
  };
}
