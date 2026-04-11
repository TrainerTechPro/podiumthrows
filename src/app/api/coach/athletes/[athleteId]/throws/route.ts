import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBody, CoachLogThrowSchema } from "@/lib/api-schemas";
import { requireCoachAthlete } from "@/lib/data/coach";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  const { athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const parsed = await parseBody(request, CoachLogThrowSchema);
  if (parsed instanceof NextResponse) return parsed;

  const {
    event,
    implementWeight,
    implementWeightUnit,
    implementWeightOriginal,
    distance,
    isCompetition,
    notes,
    videoUrl,
    rpe,
    wireLength,
  } = parsed;

  // Check if this is a PR for this event + implement weight
  let isPersonalBest = false;
  if (distance != null) {
    const currentBest = await prisma.throwLog.findFirst({
      where: {
        athleteId,
        event,
        implementWeight,
        distance: { not: null },
        isPersonalBest: true,
      },
      select: { id: true, distance: true },
    });

    if (!currentBest || (currentBest.distance != null && distance > currentBest.distance)) {
      isPersonalBest = true;
      // Unset previous PR if it exists
      if (currentBest) {
        await prisma.throwLog.update({
          where: { id: currentBest.id },
          data: { isPersonalBest: false },
        });
      }
    }
  }

  const throwLog = await prisma.throwLog.create({
    data: {
      athleteId,
      event,
      implementWeight,
      implementWeightUnit,
      implementWeightOriginal: implementWeightOriginal ?? null,
      distance: distance ?? null,
      isCompetition,
      isPersonalBest,
      notes: notes ?? null,
      videoUrl: videoUrl ?? null,
      rpe: rpe ?? null,
      wireLength: wireLength ?? null,
      sessionId: null,
    },
  });

  return NextResponse.json({ success: true, data: throwLog }, { status: 201 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  const { athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const throws = await prisma.throwLog.findMany({
    where: { athleteId },
    orderBy: { date: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, data: throws });
}
