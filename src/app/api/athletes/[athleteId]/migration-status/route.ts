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

    const unassigned = await prisma.throwLog.findMany({
      where: { athleteId, implementId: null },
      select: {
        event: true,
        implementWeight: true,
        implementWeightUnit: true,
        implementWeightOriginal: true,
      },
    });

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
      { success: false, error: "Failed to compute migration status" },
      { status: 500 }
    );
  }
}
