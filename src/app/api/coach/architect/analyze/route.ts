import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCoachApi } from "@/lib/data/coach";
import { parseBody } from "@/lib/api-schemas";
import {
  runArchitectAnalysis,
  type AvailableImplement,
  type EventType,
  type Gender,
  type TrainingPhase,
} from "@/lib/bondarchuk/architect-engine";
import { logger } from "@/lib/logger";

const AnalyzeSchema = z.object({
  athleteId: z.string().min(1),
  daysToChampionship: z.number().int().min(1).max(365),
  trainingPhase: z.enum(["ACCUMULATION", "CONVERSION", "REALIZATION"]),
});

export async function POST(request: Request) {
  let auth;
  try {
    auth = await requireCoachApi();
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(request, AnalyzeSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { athleteId, daysToChampionship, trainingPhase } = parsed;

  // Verify coach owns this athlete
  const athlete = await prisma.athleteProfile.findFirst({
    where: { id: athleteId, coachId: auth.coach.id },
    include: {
      // Catalog-keyed PRs filtered to competition bests. (athleteId,
      // implementId) uniqueness eliminates the legacy duplicate-label
      // problem so the architect engine reads a clean signal.
      athleteImplementPRs: {
        where: { bestCompDistance: { not: null } },
        orderBy: { bestCompDistance: "desc" },
        include: {
          implement: { select: { throwType: true, displayLabel: true } },
        },
      },
      // Drives equipment-aware block 1/2 weight progressions in the
      // architect engine. Falls back to canonical when missing.
      equipmentInventory: { select: { implements: true } },
    },
  });

  if (!athlete) {
    return NextResponse.json(
      { success: false, error: "Athlete not found or does not belong to this coach" },
      { status: 404 }
    );
  }

  // Determine primary event and best competition PR
  const primaryEvent = (athlete.events[0] ?? "SHOT_PUT") as EventType;
  const gender = (athlete.gender ?? "MALE") as Gender;

  // Find best competition PR for the primary event. Map ImplementType (SHOT)
  // to EventType (SHOT_PUT) when filtering.
  const bestPR = athlete.athleteImplementPRs
    .filter((pr) => {
      const event = pr.implement.throwType === "SHOT" ? "SHOT_PUT" : pr.implement.throwType;
      return event === primaryEvent && pr.bestCompDistance != null;
    })
    .map((pr) => ({ distance: pr.bestCompDistance!, implement: pr.implement.displayLabel }))[0];

  // Parse strength numbers from JSON blob
  let strengthNumbers: Record<string, number> | null = null;
  if (athlete.strengthNumbers && typeof athlete.strengthNumbers === "object") {
    const raw = athlete.strengthNumbers as Record<string, unknown>;
    // The strengthNumbers shape is { lifts: { backSquat: { current: 180 }, ... } }
    if (raw.lifts && typeof raw.lifts === "object") {
      const lifts = raw.lifts as Record<string, { current?: number }>;
      strengthNumbers = {};
      for (const [key, val] of Object.entries(lifts)) {
        if (val && typeof val.current === "number") {
          strengthNumbers[key] = val.current;
        }
      }
    }
  }

  // Parse lifestyle.stressBaseline (Master Profile, 1-10). Defensive — if
  // the column is malformed or out of range, treat as absent. Engine
  // ignores anything outside [8, 10] anyway, but we sanitize at the edge.
  let lifestyleStressBaseline: number | null = null;
  if (athlete.lifestyle && typeof athlete.lifestyle === "object") {
    const raw = athlete.lifestyle as Record<string, unknown>;
    const stress = raw.stressBaseline;
    if (typeof stress === "number" && Number.isFinite(stress) && stress >= 1 && stress <= 10) {
      lifestyleStressBaseline = stress;
    }
  }

  // Parse implements JSON from EquipmentInventory. Lenient — a corrupt
  // row should not block the analysis; we just skip equipment-aware
  // filtering and log so we know the row needs cleanup.
  let availableImplements: AvailableImplement[] | undefined;
  const rawImplements = athlete.equipmentInventory?.implements;
  if (rawImplements) {
    try {
      const parsed = JSON.parse(rawImplements);
      if (Array.isArray(parsed)) {
        availableImplements = parsed.filter(
          (e): e is AvailableImplement =>
            e &&
            typeof e === "object" &&
            typeof e.weightKg === "number" &&
            Number.isFinite(e.weightKg) &&
            typeof e.type === "string"
        );
      }
    } catch (err) {
      logger.warn("architect/analyze: equipmentInventory.implements parse failed", {
        context: "api",
        metadata: { athleteId },
        error: err,
      });
    }
  }

  const analysis = runArchitectAnalysis({
    name: `${athlete.firstName} ${athlete.lastName}`,
    event: primaryEvent,
    gender,
    pr: bestPR?.distance ?? null,
    daysToChampionship,
    trainingPhase: trainingPhase as TrainingPhase,
    strengthNumbers,
    availableImplements,
    lifestyleStressBaseline,
  });

  return NextResponse.json({ success: true, data: analysis });
}
