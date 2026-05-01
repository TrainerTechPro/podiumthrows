/**
 * Implement catalog — server-side domain logic.
 *
 * The single place catalog reads and PR aggregate maintenance live. Routes
 * call into here rather than reading raw ThrowLog data. Mirrors the
 * src/lib/performance-tests.ts pattern.
 *
 * Aggregate semantics (AthleteImplementPR)
 * ----------------------------------------
 *  bestDistance        = max(distance) across all isFoul=false throws with distance != null
 *  bestThrowLogId      = ThrowLog.id of that max row (date-desc tiebreak)
 *  bestAchievedAt      = ThrowLog.date of the best row
 *  bestContext         = "COMPETITION" if best.isCompetition else "PRACTICE"
 *  bestCompDistance    = same, restricted to isCompetition = true
 *  throwCountAllTime   = total non-foul throws (count, including null distances)
 *  lastThrownAt        = max(date)
 *
 * Zero throws → row is deleted (no orphaned PR rows).
 *
 * Catalog matching (findCatalogMatchForWeight)
 * --------------------------------------------
 *  Tolerance: ±0.05 kg.
 *  hint.unitSystem narrows ambiguous matches by primaryUnit.
 *
 *  exact      — single match with delta == 0
 *  tolerated  — single match with 0 < delta ≤ 0.05 kg
 *  ambiguous  — multiple candidates within tolerance
 *  none       — no candidate within tolerance
 */

import type {
  Prisma,
  PrismaClient,
  Implement,
  ImplementType,
  ImplementCategory,
} from "@prisma/client";
import prisma from "@/lib/prisma";

export type PrismaTx =
  | PrismaClient
  | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export const CATALOG_MATCH_TOLERANCE_KG = 0.05;

/* ─── Reads ─────────────────────────────────────────────────────────────── */

export interface ListImplementsFilter {
  throwType?: ImplementType;
  category?: ImplementCategory;
  activeOnly?: boolean;
}

/**
 * List catalog rows. Default ordering: throwType, then sortOrder asc.
 * activeOnly defaults to true — inactive implements never surface in the
 * picker. Pass activeOnly: false in admin/audit contexts only.
 */
export async function listImplements(
  filter: ListImplementsFilter = {}
): Promise<Array<Implement & { categoryTags: { category: ImplementCategory }[] }>> {
  const where: Prisma.ImplementWhereInput = {};
  if (filter.throwType) where.throwType = filter.throwType;
  if (filter.activeOnly !== false) where.active = true;
  if (filter.category) {
    where.categoryTags = { some: { category: filter.category } };
  }

  return prisma.implement.findMany({
    where,
    orderBy: [{ throwType: "asc" }, { sortOrder: "asc" }, { weightKg: "asc" }],
    include: { categoryTags: { select: { category: true } } },
  });
}

export async function getImplement(implementId: string): Promise<Implement | null> {
  return prisma.implement.findUnique({ where: { id: implementId } });
}

/**
 * Recent implements an athlete has thrown, sorted by most-recent first.
 * Used to pre-populate the picker (athletes throw the same 1-3 implements
 * over and over — surface them first, hide the rest behind "All").
 */
export async function getRecentImplementsForAthlete(
  athleteId: string,
  limit = 6
): Promise<Implement[]> {
  // Pull most-recent ThrowLog rows that have an implement; dedupe in memory.
  const recent = await prisma.throwLog.findMany({
    where: { athleteId, implementId: { not: null } },
    orderBy: { date: "desc" },
    select: { implementId: true, date: true },
    take: limit * 6, // gather extra so dedupe still yields `limit` distinct
  });

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const r of recent) {
    if (!r.implementId || seen.has(r.implementId)) continue;
    seen.add(r.implementId);
    ids.push(r.implementId);
    if (ids.length >= limit) break;
  }
  if (ids.length === 0) return [];

  const rows = await prisma.implement.findMany({ where: { id: { in: ids } } });
  // Restore the recency order — findMany doesn't preserve `in` ordering.
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((x): x is Implement => Boolean(x));
}

export async function getPR(
  athleteId: string,
  implementId: string
): Promise<Prisma.AthleteImplementPRGetPayload<{ include: { implement: true } }> | null> {
  return prisma.athleteImplementPR.findUnique({
    where: { athleteId_implementId: { athleteId, implementId } },
    include: { implement: true },
  });
}

export async function getPRsForAthlete(
  athleteId: string
): Promise<Prisma.AthleteImplementPRGetPayload<{ include: { implement: true } }>[]> {
  return prisma.athleteImplementPR.findMany({
    where: { athleteId },
    orderBy: [{ implement: { throwType: "asc" } }, { implement: { sortOrder: "asc" } }],
    include: { implement: true },
  });
}

export async function getRecentThrows(
  athleteId: string,
  implementId: string,
  limit = 10
): Promise<
  Prisma.ThrowLogGetPayload<{
    select: {
      id: true;
      distance: true;
      date: true;
      isCompetition: true;
      isFoul: true;
      isPersonalBest: true;
      notes: true;
    };
  }>[]
> {
  return prisma.throwLog.findMany({
    where: { athleteId, implementId },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      distance: true,
      date: true,
      isCompetition: true,
      isFoul: true,
      isPersonalBest: true,
      notes: true,
    },
  });
}

/* ─── Tx-bound aggregate maintenance ────────────────────────────────────── */

/**
 * Recompute the AthleteImplementPR row for one (athlete, implement) inside
 * an active transaction. Call this after every ThrowLog insert, update that
 * affects implementId/distance/isCompetition, or delete.
 *
 * Reads fresh ThrowLog rows so it's safe to call even if the caller already
 * mutated the relation in the same `tx` — Prisma sees the in-flight writes.
 *
 * If zero non-foul throws remain for the combo, deletes the PR row entirely.
 */
export async function recomputeAthleteImplementPR(
  tx: PrismaTx,
  athleteId: string,
  implementId: string
): Promise<void> {
  const throws = await tx.throwLog.findMany({
    where: {
      athleteId,
      implementId,
      isFoul: false,
    },
    orderBy: [{ distance: "desc" }, { date: "desc" }],
    select: {
      id: true,
      distance: true,
      date: true,
      isCompetition: true,
    },
  });

  if (throws.length === 0) {
    await tx.athleteImplementPR.deleteMany({
      where: { athleteId, implementId },
    });
    return;
  }

  const withDistance = throws.filter(
    (t): t is typeof t & { distance: number } => t.distance != null
  );
  const compRows = withDistance.filter((t) => t.isCompetition);

  const best = withDistance[0] ?? null;
  const bestComp = compRows[0] ?? null;
  const lastThrownAt = throws.reduce<Date>(
    (acc, t) => (t.date > acc ? t.date : acc),
    throws[0].date
  );

  await tx.athleteImplementPR.upsert({
    where: { athleteId_implementId: { athleteId, implementId } },
    create: {
      athleteId,
      implementId,
      bestDistance: best?.distance ?? null,
      bestThrowLogId: best?.id ?? null,
      bestAchievedAt: best?.date ?? null,
      bestContext: best ? (best.isCompetition ? "COMPETITION" : "PRACTICE") : null,
      bestCompDistance: bestComp?.distance ?? null,
      bestCompThrowLogId: bestComp?.id ?? null,
      bestCompAchievedAt: bestComp?.date ?? null,
      throwCountAllTime: throws.length,
      lastThrownAt,
    },
    update: {
      bestDistance: best?.distance ?? null,
      bestThrowLogId: best?.id ?? null,
      bestAchievedAt: best?.date ?? null,
      bestContext: best ? (best.isCompetition ? "COMPETITION" : "PRACTICE") : null,
      bestCompDistance: bestComp?.distance ?? null,
      bestCompThrowLogId: bestComp?.id ?? null,
      bestCompAchievedAt: bestComp?.date ?? null,
      throwCountAllTime: throws.length,
      lastThrownAt,
    },
  });
}

/**
 * Recompute many PRs in one tx. De-duplicates the input list so a bulk
 * reassign that touches 50 rows for one (athlete, implement) only runs the
 * recompute once.
 */
export async function recomputeManyPRs(
  tx: PrismaTx,
  items: { athleteId: string; implementId: string }[]
): Promise<void> {
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.athleteId}|${item.implementId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await recomputeAthleteImplementPR(tx, item.athleteId, item.implementId);
  }
}

/* ─── Catalog matching ──────────────────────────────────────────────────── */

export type CatalogMatchResult =
  | { kind: "exact"; implement: Implement; deltaKg: 0 }
  | { kind: "tolerated"; implement: Implement; deltaKg: number }
  | { kind: "ambiguous"; candidates: Implement[] }
  | { kind: "none" };

export interface CatalogMatchHint {
  /** Bias toward "kg" or "lb" rows when multiple candidates match. */
  unitSystem?: "metric" | "imperial";
}

/**
 * Find the best catalog match for a raw weightKg + throwType. Used by the
 * backfill script and any future custom-weight handling. Throws never
 * — returns "none" instead.
 *
 *   exact       — one row with weightKg matching to within 1e-6
 *   tolerated   — one row within ±0.05 kg, no exact match
 *   ambiguous   — multiple candidates within tolerance (e.g. 6.35 kg ≈ 14 lb
 *                 hammer AND 6 kg hammer with high tolerance — though those
 *                 are 0.35 kg apart, not in our tolerance)
 *   none        — nothing within tolerance
 *
 * The hint biases ambiguous → tolerated when one candidate matches the
 * preferred unit system; never overrides an exact match.
 */
export async function findCatalogMatchForWeight(
  weightKg: number,
  throwType: ImplementType,
  hint: CatalogMatchHint = {}
): Promise<CatalogMatchResult> {
  const candidates = await prisma.implement.findMany({
    where: {
      throwType,
      active: true,
      weightKg: {
        gte: weightKg - CATALOG_MATCH_TOLERANCE_KG,
        lte: weightKg + CATALOG_MATCH_TOLERANCE_KG,
      },
    },
    orderBy: { weightKg: "asc" },
  });

  if (candidates.length === 0) return { kind: "none" };

  // Find exact (delta < 1e-6).
  const exact = candidates.find((c) => Math.abs(c.weightKg - weightKg) < 1e-6);
  if (exact && candidates.length === 1) {
    return { kind: "exact", implement: exact, deltaKg: 0 };
  }

  if (candidates.length === 1) {
    const c = candidates[0];
    return {
      kind: "tolerated",
      implement: c,
      deltaKg: +Math.abs(c.weightKg - weightKg).toFixed(4),
    };
  }

  // Multiple candidates — try the hint to disambiguate.
  if (hint.unitSystem) {
    const unitFilter = hint.unitSystem === "imperial" ? "lb" : "kg";
    const preferred = candidates.filter((c) => c.primaryUnit === unitFilter);
    if (preferred.length === 1) {
      const c = preferred[0];
      const delta = +Math.abs(c.weightKg - weightKg).toFixed(4);
      if (delta < 1e-6) return { kind: "exact", implement: c, deltaKg: 0 };
      return { kind: "tolerated", implement: c, deltaKg: delta };
    }
  }

  // Hint didn't disambiguate (or wasn't given). If we DID find an exact, prefer it.
  if (exact) return { kind: "exact", implement: exact, deltaKg: 0 };

  return { kind: "ambiguous", candidates };
}
