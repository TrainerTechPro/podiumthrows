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

/**
 * Per-data-type display preferences. Each measurement type has its own
 * pref because athletes care about different units for different things —
 * a US thrower wants throws in meters (training norm) but vertical jump in
 * inches and broad jump in feet (recruiting norm).
 *
 * Sprint times are intentionally absent — seconds work universally.
 *
 * The legacy `distance` key (PR #46) is normalized to `throwDistance` on
 * read so existing prefs migrate transparently without a DB touch.
 */
export type UnitDataType =
  | "throwDistance"
  | "verticalJump"
  | "broadJump"
  | "bodyWeight"
  | "liftingWeight"
  | "height";

export type UnitPrefs = Record<UnitDataType, UnitChoice>;

export const DEFAULT_UNIT_PREFS: UnitPrefs = {
  throwDistance: "metric",
  verticalJump: "metric",
  broadJump: "metric",
  bodyWeight: "metric",
  liftingWeight: "metric",
  height: "metric",
};

export const UNIT_DATA_TYPES: UnitDataType[] = [
  "throwDistance",
  "verticalJump",
  "broadJump",
  "bodyWeight",
  "liftingWeight",
  "height",
];

export const UNIT_DATA_TYPE_LABELS: Record<UnitDataType, string> = {
  throwDistance: "Throw distance",
  verticalJump: "Vertical jump",
  broadJump: "Broad jump",
  bodyWeight: "Body weight",
  liftingWeight: "Lifting weight",
  height: "Height",
};

/**
 * Parse a free-form prefs JSON value (from Prisma) into a strict UnitPrefs
 * with defaults filled in. Any unknown shape collapses to all-metric.
 *
 * Legacy compat: a `distance` key (from PR #46 before the throwDistance/
 * verticalJump/broadJump split) is honored as a `throwDistance` fallback.
 */
export function parseUnitPrefs(raw: unknown): UnitPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_UNIT_PREFS };
  const obj = raw as Record<string, unknown>;
  const get = (key: string): UnitChoice => (obj[key] === "imperial" ? "imperial" : "metric");
  // Legacy `distance` → throwDistance fallback.
  const throwDistance: UnitChoice =
    obj.throwDistance === "imperial" || (obj.throwDistance == null && obj.distance === "imperial")
      ? "imperial"
      : "metric";
  return {
    throwDistance,
    verticalJump: get("verticalJump"),
    broadJump: get("broadJump"),
    bodyWeight: get("bodyWeight"),
    liftingWeight: get("liftingWeight"),
    height: get("height"),
  };
}
