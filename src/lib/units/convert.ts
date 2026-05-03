/**
 * Unit conversion + formatting.
 *
 * Server stores canonical metric values. These helpers convert + format
 * for display only. Inputs that round-trip through the UI (e.g. wizard
 * forms) keep their own per-form unit toggle — display prefs do not
 * change input behavior.
 */

import type { UnitChoice } from "./types";

export const KG_PER_LB = 0.45359237;
export const M_PER_FT = 0.3048;
export const CM_PER_IN = 2.54;
export const IN_PER_FT = 12;

export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const mToFt = (m: number): number => m / M_PER_FT;
export const cmToIn = (cm: number): number => cm / CM_PER_IN;

/** "200′ 10″" — coach-throws coaches read distance as feet + inches. */
export function metersToFtInString(m: number): string {
  if (!Number.isFinite(m)) return "—";
  const totalIn = (m / M_PER_FT) * IN_PER_FT;
  let ft = Math.floor(totalIn / IN_PER_FT);
  let inches = Math.round(totalIn - ft * IN_PER_FT);
  // 12" rollover after rounding
  if (inches === IN_PER_FT) {
    ft += 1;
    inches = 0;
  }
  return `${ft}′ ${inches}″`;
}

/** "6′ 4″" — height conversion from cm. */
export function cmToFtInString(cm: number): string {
  if (!Number.isFinite(cm)) return "—";
  const totalIn = cm / CM_PER_IN;
  let ft = Math.floor(totalIn / IN_PER_FT);
  let inches = Math.round(totalIn - ft * IN_PER_FT);
  if (inches === IN_PER_FT) {
    ft += 1;
    inches = 0;
  }
  return `${ft}′ ${inches}″`;
}

/* ─── Per-data-type formatters ─────────────────────────────────────────── */

/** Throw distance — meters or feet+inches. Stored in meters. */
export function formatThrowDistance(meters: number, unit: UnitChoice): string {
  if (!Number.isFinite(meters)) return "—";
  if (unit === "imperial") return metersToFtInString(meters);
  return `${meters.toFixed(2)} m`;
}

/** Legacy alias — kept for any in-flight callers. New code should call
 *  formatThrowDistance directly. */
export const formatDistance = formatThrowDistance;

/**
 * Vertical jump — cm or inches. Stored in cm.
 * Imperial = whole inches with a `"` glyph (e.g. `32"`) since vertical
 * jumps fit cleanly in single-digit inches above 24"; ft+in is wrong scale.
 */
export function formatVerticalJump(cm: number, unit: UnitChoice): string {
  if (!Number.isFinite(cm)) return "—";
  if (unit === "imperial") return `${Math.round(cm * (1 / CM_PER_IN))}"`;
  return `${cm.toFixed(1)} cm`;
}

/**
 * Broad jump — meters or feet+inches. Stored in cm.
 * Imperial = ft+in (typical broad jump 6–12 ft). Metric = decimal meters
 * (matches throws — coaches read a "2.85 m" broad jump the same way they
 * read a hammer throw).
 */
export function formatBroadJump(cm: number, unit: UnitChoice): string {
  if (!Number.isFinite(cm)) return "—";
  const meters = cm / 100;
  if (unit === "imperial") return metersToFtInString(meters);
  return `${meters.toFixed(2)} m`;
}

export function formatBodyWeight(kg: number, unit: UnitChoice): string {
  if (!Number.isFinite(kg)) return "—";
  if (unit === "imperial") return `${kgToLb(kg).toFixed(1)} lb`;
  return `${kg.toFixed(1)} kg`;
}

export function formatLiftingWeight(kg: number, unit: UnitChoice): string {
  if (!Number.isFinite(kg)) return "—";
  if (unit === "imperial") return `${kgToLb(kg).toFixed(1)} lb`;
  // Lifting weights are usually whole numbers (60, 80, 100); only show a
  // decimal when there is one (e.g. 102.5).
  return Number.isInteger(kg) ? `${kg} kg` : `${kg.toFixed(1)} kg`;
}

export function formatHeight(cm: number, unit: UnitChoice): string {
  if (!Number.isFinite(cm)) return "—";
  if (unit === "imperial") return cmToFtInString(cm);
  return `${Math.round(cm)} cm`;
}

/** Compact unit suffix only (for chart axis labels, segmented toggles, etc.). */
export function unitSuffix(
  type: "throwDistance" | "verticalJump" | "broadJump" | "bodyWeight" | "liftingWeight" | "height",
  unit: UnitChoice
): string {
  if (type === "throwDistance" || type === "broadJump") return unit === "imperial" ? "ft" : "m";
  if (type === "verticalJump") return unit === "imperial" ? "in" : "cm";
  if (type === "height") return unit === "imperial" ? "in" : "cm";
  return unit === "imperial" ? "lb" : "kg";
}

/** Numeric conversion for chart axis math (no formatting). */
export function convertForAxis(
  type: "throwDistance" | "verticalJump" | "broadJump" | "bodyWeight" | "liftingWeight" | "height",
  canonical: number,
  unit: UnitChoice
): number {
  if (unit === "metric") return canonical;
  if (type === "throwDistance") return mToFt(canonical);
  if (type === "broadJump") return mToFt(canonical / 100); // canonical cm → ft
  if (type === "verticalJump" || type === "height") return cmToIn(canonical);
  return kgToLb(canonical);
}
