/**
 * Shared throw utilities — PR detection, implement weights, event helpers.
 *
 * Used by both the session log route (within-session throws) and the
 * standalone throw log route (quick-log throws).
 */

import prisma from "@/lib/prisma";

/* ─── Constants ──────────────────────────────────────────────────────────── */

export const VALID_EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"] as const;

export const COMPETITION_WEIGHTS: Record<
  string,
  { male: number; female: number }
> = {
  SHOT_PUT: { male: 7.26, female: 4.0 },
  DISCUS: { male: 2.0, female: 1.0 },
  HAMMER: { male: 7.26, female: 4.0 },
  JAVELIN: { male: 0.8, female: 0.6 },
};

/**
 * Common implement weights used in training by event + gender.
 * Includes competition weight plus typical over/underweight implements.
 */
export const IMPLEMENT_PRESETS: Record<
  string,
  { male: number[]; female: number[] }
> = {
  SHOT_PUT: {
    male: [9.0, 8.0, 7.26, 6.0, 5.0],
    female: [5.0, 4.5, 4.0, 3.0],
  },
  DISCUS: {
    male: [2.5, 2.0, 1.75, 1.5],
    female: [1.25, 1.0, 0.75],
  },
  HAMMER: {
    male: [9.0, 8.0, 7.26, 6.0, 5.0],
    female: [5.0, 4.5, 4.0, 3.0],
  },
  JAVELIN: {
    male: [0.9, 0.8, 0.7, 0.6],
    female: [0.7, 0.6, 0.5],
  },
};

/* ─── Wire Length (Hammer only) ──────────────────────────────────────────── */

export const WIRE_LENGTH_OPTIONS = [
  { value: "FULL", label: "Full" },
  { value: "THREE_QUARTER", label: "¾" },
  { value: "HALF", label: "½" },
] as const;

export type WireLength = (typeof WIRE_LENGTH_OPTIONS)[number]["value"];

/* ─── Default drill per event ────────────────────────────────────────────── */

export const DEFAULT_DRILL_BY_EVENT: Record<string, string> = {
  SHOT_PUT: "Full Throw",
  DISCUS: "Full Throw",
  HAMMER: "Full Throw (4 Turns)",
  JAVELIN: "Full Throw",
};

/* ─── Unit conversion ────────────────────────────────────────────────────── */

export const LBS_TO_KG = 1 / 2.20462;
export const KG_TO_LBS = 2.20462;

/* ─── Weight Display ─────────────────────────────────────────────────────── */

/**
 * Formats an implement weight for display using the original unit.
 * Falls back to kg if no original value/unit stored (legacy data).
 *
 * Examples:
 *   formatImplementWeight(6.35, "lbs", 14)  → "14lbs"
 *   formatImplementWeight(7.26, "kg", 7.26) → "7.26kg"
 *   formatImplementWeight(7.26)             → "7.26kg"  (legacy)
 *   formatImplementWeight(null)             → "—"
 */
export function formatImplementWeight(
  weightKg: number | null | undefined,
  unit?: string | null,
  original?: number | null,
): string {
  if (weightKg == null) return "—";
  if (original != null && unit) {
    // Strip trailing zeros for cleaner display (14.00 → 14, 4.50 → 4.5)
    const display = parseFloat(original.toFixed(2));
    return `${display}${unit}`;
  }
  const display = parseFloat(weightKg.toFixed(2));
  return `${display}kg`;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

export function isValidEvent(event: unknown): event is string {
  return typeof event === "string" && VALID_EVENTS.includes(event as never);
}

export function getCompetitionWeight(
  event: string,
  gender: "male" | "female"
): number {
  return COMPETITION_WEIGHTS[event]?.[gender] ?? 0;
}

export function getImplementPresets(
  event: string,
  gender: "male" | "female"
): number[] {
  return IMPLEMENT_PRESETS[event]?.[gender] ?? [];
}

/* ─── PR Detection ───────────────────────────────────────────────────────── */

/**
 * Checks if a throw is a personal best for the given event + implement combo.
 * If it is, unmarks any previous PR and returns `isPersonalBest: true`.
 *
 * This logic is shared between session-based logging and standalone logging.
 */
export async function checkAndSetPR(
  athleteId: string,
  event: string,
  implementWeight: number,
  distance: number
): Promise<{ isPersonalBest: boolean }> {
  const existingBest = await prisma.throwLog.findFirst({
    where: {
      athleteId,
      event: event as never,
      implementWeight,
      isPersonalBest: true,
    },
    select: { id: true, distance: true },
  });

  const isPersonalBest = !existingBest || distance > existingBest.distance;

  // If new PR, unmark the old one
  if (isPersonalBest && existingBest) {
    await prisma.throwLog.update({
      where: { id: existingBest.id },
      data: { isPersonalBest: false },
    });
  }

  return { isPersonalBest };
}
