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

/* ─── Viewer → coach resolution ─────────────────────────────────────────── */

/**
 * Given a logged-in user, resolve which coach's custom catalog they should
 * see merged with the global catalog:
 *   • COACH   → their own CoachProfile.id
 *   • ATHLETE → their AthleteProfile.coachId (the coach who owns the roster)
 *
 * Returns null if no coach context applies — caller should fall back to
 * global catalog only. Cheap single-row lookup; safe to call per request.
 */
export async function resolveViewerCoachId(
  userId: string,
  role: "COACH" | "ATHLETE"
): Promise<string | null> {
  if (role === "COACH") {
    const coach = await prisma.coachProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return coach?.id ?? null;
  }
  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId },
    select: { coachId: true },
  });
  return athlete?.coachId ?? null;
}

/* ─── Reads ─────────────────────────────────────────────────────────────── */

export interface ListImplementsFilter {
  throwType?: ImplementType;
  category?: ImplementCategory;
  activeOnly?: boolean;
  /**
   * When set, returned rows include this coach's custom implements (rows
   * with ownerId === viewerCoachId) in addition to the global catalog
   * (ownerId === null). Other coaches' customs are never returned.
   *
   * Omit (or pass null) to get the global catalog only — used by the
   * unauthenticated landing pages and the legacy `/api/implements` shape.
   */
  viewerCoachId?: string | null;
  /**
   * Drop WEIGHT_THROW rows (tires, plates, weighted balls). These are coach
   * customs that aren't competition events and aren't recordable in the
   * throw log — `/api/throws` 400s if you try. Setting this flag at the
   * read layer is belt-and-suspenders: the picker also de-facto hides them
   * via THROW_TYPE_ORDER, but a future engineer adding WEIGHT_THROW to that
   * order would silently surface unloggable items without this guard.
   */
  loggableInThrowLog?: boolean;
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
  if (filter.loggableInThrowLog) {
    where.throwType = filter.throwType ?? { not: "WEIGHT_THROW" };
  }
  // Scope to global ∪ viewer's customs. Omitting the field returns globals only.
  where.OR = filter.viewerCoachId
    ? [{ ownerId: null }, { ownerId: filter.viewerCoachId }]
    : [{ ownerId: null }];

  return prisma.implement.findMany({
    where,
    // Globals first (sortOrder is dense in the 100-700 range), customs after
    // (we initialize them at sortOrder 1000+ so they trail naturally).
    orderBy: [{ throwType: "asc" }, { sortOrder: "asc" }, { weightKg: "asc" }],
    include: { categoryTags: { select: { category: true } } },
  });
}

/**
 * List a single coach's custom implements only (no globals). Used by the
 * coach Settings → Implements page so the coach sees just what they own.
 * Returns inactive (soft-deleted) rows too, so the UI can offer "restore".
 */
export async function listCustomImplementsForCoach(
  coachId: string
): Promise<Array<Implement & { categoryTags: { category: ImplementCategory }[] }>> {
  return prisma.implement.findMany({
    where: { ownerId: coachId },
    orderBy: [{ active: "desc" }, { throwType: "asc" }, { sortOrder: "asc" }],
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
 * an active transaction. Call this after any throw model insert/update that
 * affects implementId/distance/isCompetition, or delete.
 *
 * Reads fresh rows so it's safe to call even if the caller already mutated
 * the relations in the same `tx` — Prisma sees the in-flight writes.
 *
 * Unions sources for the all-time best:
 *   - ThrowLog where isFoul=false, distance != null
 *   - AthleteDrillLog where bestMark > 0
 *   - PracticeAttempt where distance != null (coach-led live practice)
 *   - ThrowsBlockLog where distance != null (structured session throws)
 *
 * Competition best stays ThrowLog-only (the other three models have no
 * isCompetition flag — they're training-only by model definition).
 *
 * If zero candidates remain for the combo, deletes the PR row entirely.
 */
export async function recomputeAthleteImplementPR(
  tx: PrismaTx,
  athleteId: string,
  implementId: string
): Promise<void> {
  const [throwLogRows, drillRows, practiceRows, blockLogRows] = await Promise.all([
    tx.throwLog.findMany({
      where: { athleteId, implementId, isFoul: false },
      select: { id: true, distance: true, date: true, isCompetition: true },
    }),
    tx.athleteDrillLog.findMany({
      where: {
        implementId,
        session: { athleteId },
        bestMark: { not: null, gt: 0 },
      },
      select: {
        id: true,
        bestMark: true,
        createdAt: true,
        session: { select: { date: true } },
      },
    }),
    tx.practiceAttempt.findMany({
      where: { athleteId, implementId, distance: { not: null } },
      select: { id: true, distance: true, createdAt: true },
    }),
    tx.throwsBlockLog.findMany({
      where: {
        implementId,
        distance: { not: null },
        assignment: { athleteId },
      },
      select: {
        id: true,
        distance: true,
        createdAt: true,
      },
    }),
  ]);

  // Normalize into a unified candidate shape.
  type Candidate = {
    id: string;
    distance: number | null;
    date: Date;
    isCompetition: boolean;
  };

  const candidates: Candidate[] = [
    ...throwLogRows.map((t) => ({
      id: t.id,
      distance: t.distance,
      date: t.date,
      isCompetition: t.isCompetition,
    })),
    ...drillRows.map((d) => ({
      id: d.id,
      distance: d.bestMark,
      // AthleteThrowsSession.date is a YYYY-MM-DD string; fall back to createdAt.
      date: d.session.date ? new Date(d.session.date + "T00:00:00") : d.createdAt,
      isCompetition: false,
    })),
    ...practiceRows.map((p) => ({
      id: p.id,
      distance: p.distance,
      date: p.createdAt,
      isCompetition: false,
    })),
    ...blockLogRows.map((b) => ({
      id: b.id,
      distance: b.distance,
      date: b.createdAt,
      isCompetition: false,
    })),
  ];

  if (candidates.length === 0) {
    await tx.athleteImplementPR.deleteMany({ where: { athleteId, implementId } });
    return;
  }

  // Sort: distance desc, date desc — top is the all-time best.
  candidates.sort((a, b) => {
    const da = a.distance ?? -Infinity;
    const db = b.distance ?? -Infinity;
    if (db !== da) return db - da;
    return b.date.getTime() - a.date.getTime();
  });

  const withDistance = candidates.filter(
    (t): t is Candidate & { distance: number } => t.distance != null
  );
  const compRows = withDistance.filter((t) => t.isCompetition);

  const best = withDistance[0] ?? null;
  const bestComp = compRows[0] ?? null;
  const lastThrownAt = candidates.reduce<Date>(
    (acc, t) => (t.date > acc ? t.date : acc),
    candidates[0].date
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
      throwCountAllTime: candidates.length,
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
      throwCountAllTime: candidates.length,
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

/* ─── Custom implements (per-coach) ─────────────────────────────────────── */

const KG_PER_LB = 0.45359237;
const round2 = (n: number) => Math.round(n * 100) / 100;
/// Customs sort after every global row (globals top out around 700).
const CUSTOM_SORT_BASE = 1000;

export interface CustomImplementInput {
  throwType: ImplementType;
  /// Weight in the unit the coach typed it in.
  weight: number;
  unit: "kg" | "lb";
  /// Optional override. When omitted, derived from weight+unit
  /// (e.g. 18 + "lb" → "18 lb"). Coaches override for variants:
  /// "18 lb · 3/4 wire", "20 kg plate", "tire (large)".
  displayLabel?: string;
  /// Optional override. Compact picker label. Defaults to displayLabel
  /// with spaces removed.
  shortLabel?: string;
  notes?: string;
  categories?: ImplementCategory[];
}

function deriveLabels(input: CustomImplementInput): { displayLabel: string; shortLabel: string } {
  const auto = `${input.weight} ${input.unit}`;
  const displayLabel = input.displayLabel?.trim() || auto;
  const shortLabel = input.shortLabel?.trim() || displayLabel.replace(/\s+/g, "");
  return { displayLabel, shortLabel };
}

function normalizeWeight(input: CustomImplementInput): { weightKg: number; weightLb: number } {
  if (input.unit === "kg") {
    const weightKg = round2(input.weight);
    return { weightKg, weightLb: round2(weightKg / KG_PER_LB) };
  }
  const weightLb = round2(input.weight);
  return { weightKg: round2(weightLb * KG_PER_LB), weightLb };
}

/**
 * Create a custom implement owned by `coachId`. Validates the (coach,
 * naturalKey) uniqueness via the partial index — Prisma will throw P2002
 * if the coach already has this exact implement; callers translate that
 * to a 409. Categories default to empty (no tags).
 */
export async function createCustomImplement(
  coachId: string,
  input: CustomImplementInput
): Promise<Implement> {
  const { displayLabel, shortLabel } = deriveLabels(input);
  const { weightKg, weightLb } = normalizeWeight(input);

  // Highest existing custom sortOrder + 10 keeps creations in chronological
  // order without us having to pick a number.
  const last = await prisma.implement.findFirst({
    where: { ownerId: coachId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? CUSTOM_SORT_BASE - 10) + 10;

  return prisma.$transaction(async (tx) => {
    const created = await tx.implement.create({
      data: {
        throwType: input.throwType,
        weightKg,
        weightLb,
        primaryUnit: input.unit,
        displayLabel,
        shortLabel,
        notes: input.notes?.trim() || null,
        ownerId: coachId,
        sortOrder,
        active: true,
      },
    });
    if (input.categories?.length) {
      await tx.implementCategoryTag.createMany({
        data: input.categories.map((category) => ({ implementId: created.id, category })),
        skipDuplicates: true,
      });
    }
    return created;
  });
}

export interface UpdateCustomImplementInput {
  displayLabel?: string;
  shortLabel?: string;
  notes?: string | null;
  categories?: ImplementCategory[];
  active?: boolean;
}

/**
 * Update a custom implement. Throws if the implement isn't owned by the
 * caller (or doesn't exist). Weight + throwType + unit are immutable —
 * those changes would invalidate every historical PR. Coach should
 * deactivate-and-recreate instead.
 */
export async function updateCustomImplement(
  coachId: string,
  implementId: string,
  input: UpdateCustomImplementInput
): Promise<Implement> {
  const existing = await prisma.implement.findUnique({
    where: { id: implementId },
    select: { id: true, ownerId: true },
  });
  if (!existing || existing.ownerId !== coachId) {
    throw new Error("Implement not found or not owned by this coach");
  }

  return prisma.$transaction(async (tx) => {
    const data: Prisma.ImplementUpdateInput = {};
    if (input.displayLabel !== undefined) data.displayLabel = input.displayLabel.trim();
    if (input.shortLabel !== undefined) data.shortLabel = input.shortLabel.trim();
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    if (input.active !== undefined) data.active = input.active;

    const updated = await tx.implement.update({ where: { id: implementId }, data });

    if (input.categories) {
      await tx.implementCategoryTag.deleteMany({
        where: { implementId, category: { notIn: input.categories } },
      });
      if (input.categories.length) {
        await tx.implementCategoryTag.createMany({
          data: input.categories.map((category) => ({ implementId, category })),
          skipDuplicates: true,
        });
      }
    }
    return updated;
  });
}

/**
 * Soft-delete (active=false). We never hard-delete custom implements
 * because historical ThrowLog / AthleteImplementPR rows reference them
 * — losing the row would break PR history. The picker filters on
 * active=true, so soft-deleted customs disappear from athlete UI but
 * old throws still resolve their implement label correctly.
 */
export async function softDeleteCustomImplement(
  coachId: string,
  implementId: string
): Promise<void> {
  const existing = await prisma.implement.findUnique({
    where: { id: implementId },
    select: { id: true, ownerId: true },
  });
  if (!existing || existing.ownerId !== coachId) {
    throw new Error("Implement not found or not owned by this coach");
  }
  await prisma.implement.update({ where: { id: implementId }, data: { active: false } });
}
