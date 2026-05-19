import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { findCatalogMatchForWeight } from "@/lib/implements";
import type { ImplementType } from "@prisma/client";

type RouteCtx = { params: Promise<{ athleteId: string }> };

/** EventType (SHOT_PUT) → ImplementType (SHOT). */
function implementTypeFromEvent(event: string): ImplementType | null {
  if (event === "SHOT_PUT") return "SHOT";
  if (event === "HAMMER" || event === "DISCUS" || event === "JAVELIN") {
    return event;
  }
  return null;
}

interface FixGroup {
  event: string;
  weightKg: number;
  /** Most-common preserved unit on the throws in this group ("kg" | "lbs"). */
  unit: string;
  /** Most-common preserved original-as-typed value. */
  original: number | null;
  throwCount: number;
  /** Catalog row to confirm with one click — null when ambiguous. */
  bestGuessImplementId: string | null;
  bestGuessLabel: string | null;
  bestGuessKind: "exact" | "tolerated" | "ambiguous" | "none";
  candidates: Array<{ id: string; label: string; primaryUnit: string }>;
}

/**
 * GET /api/athletes/:athleteId/migration-status
 *
 * Drives the Fix Old Throws UI. Groups every UNASSIGNED ThrowLog by
 * (event, implementWeight) and computes the catalog's best guess (using the
 * preserved per-throw unit as the hint). Banner self-hides when totalUnassigned=0.
 */
export async function GET(_request: NextRequest, ctx: RouteCtx) {
  try {
    const { athleteId } = await ctx.params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canAccessAthlete(session.userId, session.role, athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Pull unassigned rows from all four throw sources. The first two preserve
    // the per-throw unit; PracticeAttempt + ThrowsBlockLog only have a String
    // implement label, so we parse it for the kg + derive the unit from the
    // suffix.
    const KG_PER_LB = 0.45359237;
    const parseLabel = (label: string): { kg: number; unit: string } | null => {
      const m = label
        .trim()
        .toLowerCase()
        .match(/^(-?\d+(?:\.\d+)?)\s*(kg|lbs?|g)?$/);
      if (!m) return null;
      const n = parseFloat(m[1]);
      if (!Number.isFinite(n) || n <= 0) return null;
      const u = m[2];
      if (u === "lb" || u === "lbs") return { kg: n * KG_PER_LB, unit: "lbs" };
      if (u === "g") return { kg: n * 0.001, unit: "kg" };
      return { kg: n, unit: "kg" };
    };

    const [throwLogs, drillLogs, practiceAttempts, blockLogs] = await Promise.all([
      prisma.throwLog.findMany({
        where: { athleteId, implementId: null },
        select: {
          event: true,
          implementWeight: true,
          implementWeightUnit: true,
          implementWeightOriginal: true,
        },
      }),
      prisma.athleteDrillLog.findMany({
        where: {
          session: { athleteId },
          implementId: null,
          implementWeight: { not: null, gt: 0 },
        },
        select: {
          implementWeight: true,
          implementWeightUnit: true,
          implementWeightOriginal: true,
          session: { select: { event: true } },
        },
      }),
      prisma.practiceAttempt.findMany({
        where: { athleteId, implementId: null },
        select: { event: true, implement: true },
      }),
      prisma.throwsBlockLog.findMany({
        where: { assignment: { athleteId }, implementId: null },
        select: {
          implement: true,
          assignment: { select: { session: { select: { event: true } } } },
        },
      }),
    ]);

    // Normalize all four into a single shape: { event, weightKg, unit, original }.
    const unassigned: Array<{
      event: string;
      implementWeight: number;
      implementWeightUnit: string | null;
      implementWeightOriginal: number | null;
    }> = [];
    for (const r of throwLogs) unassigned.push(r);
    for (const r of drillLogs) {
      if (r.implementWeight == null) continue;
      unassigned.push({
        event: r.session.event,
        implementWeight: r.implementWeight,
        implementWeightUnit: r.implementWeightUnit,
        implementWeightOriginal: r.implementWeightOriginal,
      });
    }
    for (const r of practiceAttempts) {
      const parsed = parseLabel(r.implement);
      if (!parsed) continue;
      unassigned.push({
        event: r.event,
        implementWeight: parsed.kg,
        implementWeightUnit: parsed.unit,
        implementWeightOriginal: null,
      });
    }
    for (const r of blockLogs) {
      const event = r.assignment.session?.event;
      if (!event) continue;
      const parsed = parseLabel(r.implement);
      if (!parsed) continue;
      unassigned.push({
        event,
        implementWeight: parsed.kg,
        implementWeightUnit: parsed.unit,
        implementWeightOriginal: null,
      });
    }

    if (unassigned.length === 0) {
      return NextResponse.json({
        success: true,
        data: { totalUnassigned: 0, totalAmbiguous: 0, groups: [] },
      });
    }

    // Group by (event, weightKg) — round to 4 decimals to merge near-identical floats.
    const groups = new Map<
      string,
      {
        event: string;
        weightKg: number;
        units: Map<string, number>;
        originals: Map<string, { value: number | null; count: number }>;
        count: number;
      }
    >();

    for (const r of unassigned) {
      const key = `${r.event}|${Math.round(r.implementWeight * 10000) / 10000}`;
      const bucket =
        groups.get(key) ??
        ({
          event: r.event,
          weightKg: r.implementWeight,
          units: new Map(),
          originals: new Map(),
          count: 0,
        } as ReturnType<typeof groups.get> & object);
      bucket.count++;
      const unit = r.implementWeightUnit ?? "kg";
      bucket.units.set(unit, (bucket.units.get(unit) ?? 0) + 1);
      const origKey =
        r.implementWeightOriginal == null ? "null" : String(r.implementWeightOriginal);
      const cur = bucket.originals.get(origKey) ?? { value: r.implementWeightOriginal, count: 0 };
      cur.count++;
      bucket.originals.set(origKey, cur);
      groups.set(key, bucket);
    }

    const out: FixGroup[] = [];
    let ambiguousTotal = 0;

    for (const bucket of groups.values()) {
      // Mode unit + original for display in the Fix row.
      let topUnit = "kg";
      let topUnitN = -1;
      for (const [u, n] of bucket.units) {
        if (n > topUnitN) {
          topUnit = u;
          topUnitN = n;
        }
      }
      let topOriginal: number | null = null;
      let topOriginalN = -1;
      for (const cur of bucket.originals.values()) {
        if (cur.count > topOriginalN) {
          topOriginal = cur.value;
          topOriginalN = cur.count;
        }
      }

      const throwType = implementTypeFromEvent(bucket.event);
      if (!throwType) {
        ambiguousTotal += bucket.count;
        out.push({
          event: bucket.event,
          weightKg: bucket.weightKg,
          unit: topUnit,
          original: topOriginal,
          throwCount: bucket.count,
          bestGuessImplementId: null,
          bestGuessLabel: null,
          bestGuessKind: "none",
          candidates: [],
        });
        continue;
      }

      const hint =
        topUnit === "lbs" || topUnit === "lb"
          ? { unitSystem: "imperial" as const }
          : { unitSystem: "metric" as const };
      const match = await findCatalogMatchForWeight(bucket.weightKg, throwType, hint);

      if (match.kind === "exact" || match.kind === "tolerated") {
        out.push({
          event: bucket.event,
          weightKg: bucket.weightKg,
          unit: topUnit,
          original: topOriginal,
          throwCount: bucket.count,
          bestGuessImplementId: match.implement.id,
          bestGuessLabel: match.implement.displayLabel,
          bestGuessKind: match.kind,
          candidates: [
            {
              id: match.implement.id,
              label: match.implement.displayLabel,
              primaryUnit: match.implement.primaryUnit,
            },
          ],
        });
      } else if (match.kind === "ambiguous") {
        ambiguousTotal += bucket.count;
        out.push({
          event: bucket.event,
          weightKg: bucket.weightKg,
          unit: topUnit,
          original: topOriginal,
          throwCount: bucket.count,
          bestGuessImplementId: null,
          bestGuessLabel: null,
          bestGuessKind: "ambiguous",
          candidates: match.candidates.map((c) => ({
            id: c.id,
            label: c.displayLabel,
            primaryUnit: c.primaryUnit,
          })),
        });
      } else {
        ambiguousTotal += bucket.count;
        out.push({
          event: bucket.event,
          weightKg: bucket.weightKg,
          unit: topUnit,
          original: topOriginal,
          throwCount: bucket.count,
          bestGuessImplementId: null,
          bestGuessLabel: null,
          bestGuessKind: "none",
          candidates: [],
        });
      }
    }

    out.sort((a, b) => b.throwCount - a.throwCount);

    return NextResponse.json({
      success: true,
      data: {
        totalUnassigned: unassigned.length,
        totalAmbiguous: ambiguousTotal,
        groups: out,
      },
    });
  } catch (error) {
    logger.error("GET /api/athletes/[athleteId]/migration-status", { context: "throws", error });
    return NextResponse.json(
      { success: false, error: "Couldn’t compute migration status" },
      { status: 500 }
    );
  }
}
