/**
 * Canonical Personal Record (PR) write path for athlete throws.
 *
 * Enforces the invariant: for every (athleteId, event, implementKg) triple,
 *   1. ThrowsPR has exactly 0 or 1 row — the max distance (source of truth).
 *   2. ThrowLog.isPersonalBest=true on exactly 0 or 1 row matching that max.
 *   3. Both are updated atomically inside prisma.$transaction.
 *
 * Callers should use recordThrow() whenever a throw distance is persisted.
 * The caller still creates its own row (ThrowLog, ThrowsBlockLog, etc.) and
 * flips the isPersonalBest flag on its new row if recordThrow returns a PR.
 *
 * Note: implementLabel is not normalized across sources. A throw logged as
 * "7.26kg" and another as "7.26" will be separate ThrowsPR rows. Callers
 * should be consistent with the label they pass for a given implement. A
 * future cleanup pass can add cross-label normalization.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";

/** Tx-bindable client — accepts both `prisma` and a `prisma.$transaction(tx)` callback param. */
export type PrismaTx =
  | PrismaClient
  | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export type PersonalRecordSource = "TRAINING" | "COMPETITION";

export interface RecordThrowInput {
  athleteId: string;
  event: string; // SHOT_PUT | DISCUS | HAMMER | JAVELIN
  implementWeightKg: number;
  /** Defaults to `${implementWeightKg}kg`. Pass explicitly to preserve the
   *  original unit (e.g. "14lbs", "800g"). */
  implementLabel?: string;
  distance: number; // meters
  /** Defaults to "TRAINING". */
  source?: PersonalRecordSource;
  /** Defaults to today. Accepts Date or YYYY-MM-DD string. */
  achievedAt?: Date | string;
}

export interface RecordThrowResult {
  isPersonalBest: boolean;
  previousDistance: number | null;
  /** ISO date (YYYY-MM-DD) of the *old* PR before this write — null when this
   *  is the first PR or the previous best came from legacy ThrowLog data
   *  with no associated achievement date. Used by clients to render
   *  "+0.18m over your previous best from April 2" copy. */
  previousAchievedAt: string | null;
  pr: {
    id: string;
    distance: number;
    implement: string;
    achievedAt: string;
  } | null;
}

export interface CheckIsPersonalBestInput {
  athleteId: string;
  event: string;
  implementWeightKg: number;
  candidateDistance: number;
}

export interface RecalculatePRsInput {
  athleteId: string;
  /** Optional event filter. When omitted, all events are rescanned. */
  event?: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function defaultLabel(kg: number): string {
  return `${parseFloat(kg.toFixed(2))}kg`;
}

function toIsoDateString(value: Date | string | undefined): string {
  if (typeof value === "string") return value;
  const d = value ?? new Date();
  return d.toISOString().slice(0, 10);
}

/* ─── Pure reads ────────────────────────────────────────────────────────── */

/**
 * Check whether `candidateDistance` would set a new PR for this combo.
 * Consults ThrowsPR first, falls back to the legacy ThrowLog max for
 * pre-ThrowsPR data. Does not write.
 */
export async function checkIsPersonalBest(
  input: CheckIsPersonalBestInput
): Promise<{ isPersonalBest: boolean; previousDistance: number | null }> {
  const { athleteId, event, implementWeightKg, candidateDistance } = input;

  const existingPR = await prisma.throwsPR.findUnique({
    where: {
      athleteId_event_implement: {
        athleteId,
        event,
        implement: defaultLabel(implementWeightKg),
      },
    },
    select: { distance: true },
  });

  let previousDistance: number | null = existingPR?.distance ?? null;

  if (previousDistance == null) {
    const legacyBest = await prisma.throwLog.findFirst({
      where: {
        athleteId,
        event: event as never,
        implementWeight: implementWeightKg,
        distance: { not: null },
      },
      orderBy: { distance: "desc" },
      select: { distance: true },
    });
    previousDistance = legacyBest?.distance ?? null;
  }

  return {
    isPersonalBest: previousDistance == null || candidateDistance > previousDistance,
    previousDistance,
  };
}

/* ─── Write path ────────────────────────────────────────────────────────── */

/**
 * Atomic PR write. Runs inside prisma.$transaction:
 *  1. Re-reads current ThrowsPR (race-safe).
 *  2. If new PR: unmarks any previously-flagged ThrowLog rows, upserts
 *     ThrowsPR with the new distance / source / achievedAt.
 *  3. Returns the PR result for the caller to flip its own row's
 *     isPersonalBest flag.
 *
 * The caller is responsible for creating the source row (ThrowLog,
 * ThrowsBlockLog, CompetitionThrow, PracticeAttempt, etc.) and for
 * setting isPersonalBest on the NEW row if the result says so.
 */
export async function recordThrow(input: RecordThrowInput): Promise<RecordThrowResult> {
  return prisma.$transaction((tx) => recordThrowInTx(tx, input));
}

/**
 * Tx-bound variant. Use this from new write paths that already opened a
 * transaction to insert/update/delete the ThrowLog row alongside the PR
 * update — keeps everything atomic in a single tx.
 */
export async function recordThrowInTx(
  tx: PrismaTx,
  input: RecordThrowInput
): Promise<RecordThrowResult> {
  const { athleteId, event, implementWeightKg, distance, source = "TRAINING", achievedAt } = input;

  const implement = input.implementLabel ?? defaultLabel(implementWeightKg);
  const achievedAtIso = toIsoDateString(achievedAt);

  // Re-read inside tx for race safety (another request may have just set a PR).
  const existingPR = await tx.throwsPR.findUnique({
    where: {
      athleteId_event_implement: { athleteId, event, implement },
    },
    select: { id: true, distance: true, achievedAt: true },
  });

  let previousDistance: number | null = existingPR?.distance ?? null;
  const previousAchievedAt: string | null = existingPR?.achievedAt ?? null;

  // Legacy fallback only if no ThrowsPR row exists yet.
  if (previousDistance == null) {
    const legacyBest = await tx.throwLog.findFirst({
      where: {
        athleteId,
        event: event as never,
        implementWeight: implementWeightKg,
        distance: { not: null },
      },
      orderBy: { distance: "desc" },
      select: { distance: true },
    });
    previousDistance = legacyBest?.distance ?? null;
  }

  const isPersonalBest = previousDistance == null || distance > previousDistance;

  if (!isPersonalBest) {
    return {
      isPersonalBest: false,
      previousDistance,
      previousAchievedAt,
      pr: existingPR
        ? {
            id: existingPR.id,
            distance: existingPR.distance,
            implement,
            achievedAt: previousAchievedAt ?? achievedAtIso,
          }
        : null,
    };
  }

  // Unmark any previously-flagged ThrowLog rows for this combo.
  // Note: the caller's NEW row (if any) will be flipped to true afterwards.
  await tx.throwLog.updateMany({
    where: {
      athleteId,
      event: event as never,
      implementWeight: implementWeightKg,
      isPersonalBest: true,
    },
    data: { isPersonalBest: false },
  });

  const pr = await tx.throwsPR.upsert({
    where: {
      athleteId_event_implement: { athleteId, event, implement },
    },
    update: {
      distance,
      achievedAt: achievedAtIso,
      source,
    },
    create: {
      athleteId,
      event,
      implement,
      distance,
      achievedAt: achievedAtIso,
      source,
    },
    select: { id: true, distance: true, implement: true, achievedAt: true },
  });

  return {
    isPersonalBest: true,
    previousDistance,
    previousAchievedAt,
    pr,
  };
}

/* ─── Recompute hook (for edit/delete flows) ────────────────────────────── */

/**
 * Rebuild ThrowsPR rows from scratch by scanning ThrowLog data.
 * Intended for edit/delete flows where a throw is removed or downgraded.
 *
 * Current scope: scans ThrowLog only. ThrowsBlockLog, CompetitionThrow,
 * PracticeAttempt, AthleteDrillLog should be folded in as the edit/delete
 * UIs that touch them are built. Tracked in the audit page (prompt #3).
 */
export async function recalculatePRs(
  input: RecalculatePRsInput
): Promise<{ rebuilt: number; deleted: number }> {
  const { athleteId, event } = input;

  const whereEvent = event ? { event: event as never } : {};

  // Find every distinct (event, implementWeight) combo the athlete has thrown.
  const combos = await prisma.throwLog.groupBy({
    by: ["event", "implementWeight"],
    where: { athleteId, ...whereEvent, distance: { not: null } },
    _max: { distance: true },
  });

  let rebuilt = 0;
  let deleted = 0;

  await prisma.$transaction(async (tx) => {
    // For every existing ThrowsPR, if the scan shows a different max, correct it.
    const existingPRs = await tx.throwsPR.findMany({
      where: { athleteId, ...whereEvent },
      select: { id: true, event: true, implement: true, distance: true },
    });

    const comboMap = new Map<string, number>();
    for (const c of combos) {
      if (c._max.distance == null) continue;
      const key = `${c.event}|${defaultLabel(c.implementWeight)}`;
      comboMap.set(key, c._max.distance);
    }

    // Delete orphan PRs (no matching throws remain).
    for (const pr of existingPRs) {
      const key = `${pr.event}|${pr.implement}`;
      const best = comboMap.get(key);
      if (best == null) {
        await tx.throwsPR.delete({ where: { id: pr.id } });
        deleted += 1;
      } else if (best !== pr.distance) {
        await tx.throwsPR.update({ where: { id: pr.id }, data: { distance: best } });
        rebuilt += 1;
      }
      comboMap.delete(key);
    }

    // Combos with no PR row yet — create them.
    for (const [key, distance] of comboMap) {
      const [comboEvent, implement] = key.split("|");
      await tx.throwsPR.create({
        data: {
          athleteId,
          event: comboEvent,
          implement,
          distance,
          achievedAt: new Date().toISOString().slice(0, 10),
          source: "TRAINING",
        },
      });
      rebuilt += 1;
    }

    // Sync ThrowLog.isPersonalBest flags: for every (event, implementWeight)
    // combo, mark exactly the highest-distance row as isPersonalBest=true.
    for (const c of combos) {
      if (c._max.distance == null) continue;
      await tx.throwLog.updateMany({
        where: {
          athleteId,
          event: c.event as never,
          implementWeight: c.implementWeight,
          isPersonalBest: true,
        },
        data: { isPersonalBest: false },
      });
      // Mark the first row matching the max as the PR.
      const topRow = await tx.throwLog.findFirst({
        where: {
          athleteId,
          event: c.event as never,
          implementWeight: c.implementWeight,
          distance: c._max.distance,
        },
        orderBy: { date: "desc" },
        select: { id: true },
      });
      if (topRow) {
        await tx.throwLog.update({
          where: { id: topRow.id },
          data: { isPersonalBest: true },
        });
      }
    }
  });

  return { rebuilt, deleted };
}

// Re-export Prisma type for callers that need the raw row shape.
export type ThrowsPRRow = Prisma.ThrowsPRGetPayload<{
  select: { id: true; distance: true; implement: true; achievedAt: true };
}>;
