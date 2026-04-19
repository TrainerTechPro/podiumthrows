/**
 * Shared throw utilities — PR detection, implement weights, event helpers.
 *
 * Used by both the session log route (within-session throws) and the
 * standalone throw log route (quick-log throws).
 */

import prisma from "@/lib/prisma";
import { COMPETITION_WEIGHTS_BY_EVENT } from "@/lib/throws/constants";

/* ─── Constants ──────────────────────────────────────────────────────────── */

export const VALID_EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"] as const;

/**
 * Competition implement weights keyed by ThrowEvent ("SHOT_PUT") + lowercase
 * gender ("male"). Re-exported for back-compat with legacy consumers.
 * The canonical source (keyed by EventCode/GenderCode) lives in
 * @/lib/throws/constants; changes should be made there.
 */
export const COMPETITION_WEIGHTS = COMPETITION_WEIGHTS_BY_EVENT;

/**
 * Common implement weights used in training by event + gender.
 * Includes competition weight plus typical over/underweight implements.
 */
export const IMPLEMENT_PRESETS: Record<string, { male: number[]; female: number[] }> = {
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
  original?: number | null
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

/* ─── Coach-Friendly Display ─────────────────────────────────────────────── */

// Re-export from client-safe module so server code can import from either place
export { formatImplementDisplay } from "@/lib/throws/display";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

export function isValidEvent(event: unknown): event is string {
  return typeof event === "string" && VALID_EVENTS.includes(event as never);
}

export function getCompetitionWeight(event: string, gender: "male" | "female"): number {
  return COMPETITION_WEIGHTS[event]?.[gender] ?? 0;
}

export function getImplementPresets(event: string, gender: "male" | "female"): number[] {
  return IMPLEMENT_PRESETS[event]?.[gender] ?? [];
}

/* ─── Implement String Parsing ───────────────────────────────────────────── */

/**
 * Parses an implement label like "7.26kg", "800g", "14lbs" into a numeric
 * kilogram value. Returns null when the string can't be parsed or is
 * non-positive. Used for PR detection and analytics where the implement is
 * stored as a free-text string (ThrowsBlockLog.implement, PracticeAttempt.implement).
 *
 * Javelins are sometimes labeled in grams; lbs is supported for legacy data.
 */
export function parseImplementKg(implement: string | null | undefined): number | null {
  if (!implement) return null;
  const trimmed = implement.trim().toLowerCase();
  const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(kg|g|lb|lbs)?$/);
  if (!match) {
    const n = parseFloat(implement.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = match[2] ?? "kg";
  if (unit === "g") return n / 1000;
  if (unit === "lb" || unit === "lbs") return n * LBS_TO_KG;
  return n;
}

/* ─── PR Detection ───────────────────────────────────────────────────────── */

/**
 * Checks if a throw is a personal best for the given event + implement combo.
 *
 * Consults ThrowsPR (the canonical PR table with unique constraint on
 * athlete+event+implement) as the primary source of truth — this covers
 * both standalone throws (ThrowLog) and live-session throws (ThrowsBlockLog).
 * Falls back to ThrowLog for pre-ThrowsPR legacy data.
 *
 * Also unmarks any previously-flagged ThrowLog PR for this (event, implement)
 * so history filtering stays consistent. Callers that create ThrowLog rows
 * are responsible for flagging the NEW row as isPersonalBest themselves.
 */
export async function checkAndSetPR(
  athleteId: string,
  event: string,
  implementWeight: number,
  distance: number
): Promise<{ isPersonalBest: boolean; previousDistance: number | null }> {
  const implementStr = `${implementWeight}kg`;

  const existingPR = await prisma.throwsPR.findUnique({
    where: {
      athleteId_event_implement: { athleteId, event, implement: implementStr },
    },
    select: { distance: true },
  });

  let previousDistance: number | null = existingPR?.distance ?? null;

  if (previousDistance == null) {
    const legacyBest = await prisma.throwLog.findFirst({
      where: {
        athleteId,
        event: event as never,
        implementWeight,
        distance: { not: null },
      },
      orderBy: { distance: "desc" },
      select: { distance: true },
    });
    previousDistance = legacyBest?.distance ?? null;
  }

  const isPersonalBest = previousDistance == null || distance > previousDistance;

  if (isPersonalBest) {
    await prisma.throwLog.updateMany({
      where: {
        athleteId,
        event: event as never,
        implementWeight,
        isPersonalBest: true,
      },
      data: { isPersonalBest: false },
    });
  }

  return { isPersonalBest, previousDistance };
}
