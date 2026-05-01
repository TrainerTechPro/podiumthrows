import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCoachApi } from "@/lib/data/coach";
import { parseBody } from "@/lib/api-schemas";
import {
  runArchitectAnalysis,
  type EventType,
  type Gender,
  type TrainingPhase,
} from "@/lib/bondarchuk/architect-engine";

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

  const analysis = runArchitectAnalysis({
    name: `${athlete.firstName} ${athlete.lastName}`,
    event: primaryEvent,
    gender,
    pr: bestPR?.distance ?? null,
    daysToChampionship,
    trainingPhase: trainingPhase as TrainingPhase,
    strengthNumbers,
  });

  return NextResponse.json({ success: true, data: analysis });
}
