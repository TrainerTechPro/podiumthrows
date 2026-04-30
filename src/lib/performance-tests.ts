import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Performance Tests — shared domain logic.
 *
 * These helpers run inside Prisma transactions or pure-function contexts.
 * They never read auth state; the route is responsible for authorization.
 *
 * Aggregate semantics
 * -------------------
 *  peak  = max value across `isValid = true` attempts (or min if lowerIsBetter)
 *  avg   = arithmetic mean across `isValid = true` attempts
 *  count = total attempts INCLUDING invalid ones
 *
 *  Zero valid attempts: peak = null, avg = null, count = total rows.
 *
 * Display precision
 * -----------------
 *  cm  → 1 decimal (e.g. "72.3 cm (28.5\")")
 *  sec → 2 decimals (e.g. "1.78 s")
 */

export type PerformanceTestUnit = "cm" | "sec";

export const CM_TO_INCHES = 0.393701;

/** Tx-bindable client — accepts both `prisma` and a `prisma.$transaction(tx)` callback param. */
export type PrismaTx =
  | PrismaClient
  | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/** Decimals for the test's display unit. cm = 1, sec = 2. Anything else falls back to 2. */
export function decimalsForUnit(unit: string): number {
  if (unit === "cm") return 1;
  if (unit === "sec") return 2;
  return 2;
}

/** Round to N decimals with floating-point safety. */
function roundTo(value: number, decimals: number): number {
  const m = Math.pow(10, decimals);
  return Math.round(value * m) / m;
}

/** Pick the better of two values for the given direction. */
export function pickBetter(a: number, b: number, lowerIsBetter: boolean): number {
  return lowerIsBetter ? Math.min(a, b) : Math.max(a, b);
}

export function cmToInches(cm: number): number {
  return cm * CM_TO_INCHES;
}

/**
 * Format a numeric test value for display.
 *
 *   cm  → "72.0 cm (28.3\")"
 *   sec → "1.78 s"
 *
 * Pass `withAlt: false` to suppress the inch parenthetical.
 */
export function formatTestValue(
  value: number,
  unit: string,
  opts: { withAlt?: boolean } = {}
): string {
  const withAlt = opts.withAlt ?? true;
  if (unit === "cm") {
    const cmStr = value.toFixed(1);
    if (!withAlt) return `${cmStr} cm`;
    const inchStr = cmToInches(value).toFixed(1);
    return `${cmStr} cm (${inchStr}")`;
  }
  if (unit === "sec") {
    return `${value.toFixed(2)} s`;
  }
  // Unknown unit — show value with two decimals, no suffix.
  return value.toFixed(2);
}

/**
 * Recompute peak / avg / attemptCount for a single session inside an active
 * transaction. Call this after every attempt insert / update / delete.
 *
 * Reads fresh attempt rows so it's safe to call even if the caller already
 * mutated the relation in the same `tx` — Prisma sees the in-flight writes.
 */
export async function recomputeSessionAggregates(
  tx: PrismaTx,
  sessionId: string
): Promise<{ peakValue: number | null; avgValue: number | null; attemptCount: number }> {
  // Need lowerIsBetter from the test type to know which direction "peak" means.
  const session = await tx.performanceTestSession.findUnique({
    where: { id: sessionId },
    select: { testType: { select: { unit: true, lowerIsBetter: true } } },
  });
  if (!session) {
    // Caller has already deleted the session; nothing to recompute.
    return { peakValue: null, avgValue: null, attemptCount: 0 };
  }

  const attempts = await tx.performanceTestAttempt.findMany({
    where: { sessionId },
    select: { value: true, isValid: true },
  });

  const validValues = attempts.filter((a) => a.isValid).map((a) => a.value);
  const totalCount = attempts.length;

  let peakValue: number | null = null;
  let avgValue: number | null = null;

  if (validValues.length > 0) {
    peakValue = session.testType.lowerIsBetter
      ? Math.min(...validValues)
      : Math.max(...validValues);

    const sum = validValues.reduce((s, v) => s + v, 0);
    const decimals = decimalsForUnit(session.testType.unit);
    avgValue = roundTo(sum / validValues.length, decimals);
  }

  await tx.performanceTestSession.update({
    where: { id: sessionId },
    data: { peakValue, avgValue, attemptCount: totalCount },
  });

  return { peakValue, avgValue, attemptCount: totalCount };
}

/**
 * Returns true if `candidateValue` would beat the athlete's all-time best for
 * the given test type. Excludes the current session (caller-provided id) so a
 * session that's mid-build doesn't compare its own attempts against itself.
 *
 * Compares against `peakValue` of every prior session whose `peakValue` is set
 * (i.e. has at least one valid attempt). When the athlete has no prior sessions
 * with valid peaks, the first non-zero attempt is a PR.
 */
export async function isAllTimePR(
  tx: PrismaTx,
  args: {
    athleteId: string;
    testTypeId: string;
    candidateValue: number;
    lowerIsBetter: boolean;
    /** Exclude this session id from the comparison (it's the one being added). */
    excludeSessionId?: string;
  }
): Promise<boolean> {
  const { athleteId, testTypeId, candidateValue, lowerIsBetter, excludeSessionId } = args;

  // Find the prior best peak. If no rows: candidate is the first PR.
  const orderBy: Prisma.PerformanceTestSessionOrderByWithRelationInput = lowerIsBetter
    ? { peakValue: "asc" }
    : { peakValue: "desc" };

  const where: Prisma.PerformanceTestSessionWhereInput = {
    athleteId,
    testTypeId,
    peakValue: { not: null },
    ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
  };

  const best = await tx.performanceTestSession.findFirst({
    where,
    orderBy,
    select: { peakValue: true },
  });

  if (!best || best.peakValue == null) return true;
  return lowerIsBetter ? candidateValue < best.peakValue : candidateValue > best.peakValue;
}

/**
 * Assign the next attemptNumber for a session inside a transaction.
 * Uses the current max + 1, NOT count + 1 — gaps from deletes are preserved.
 */
export async function nextAttemptNumber(tx: PrismaTx, sessionId: string): Promise<number> {
  const last = await tx.performanceTestAttempt.findFirst({
    where: { sessionId },
    orderBy: { attemptNumber: "desc" },
    select: { attemptNumber: true },
  });
  return (last?.attemptNumber ?? 0) + 1;
}
