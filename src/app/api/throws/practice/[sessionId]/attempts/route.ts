import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, PracticeAttemptCreateSchema } from "@/lib/api-schemas";
import { parseImplementKg } from "@/lib/throws";
import { recordThrow } from "@/lib/throws/pr";
import { findCatalogMatchForWeight, recomputeAthleteImplementPR } from "@/lib/implements";
import { EventType, type ImplementType } from "@prisma/client";

/** EventType (SHOT_PUT) → ImplementType (SHOT). */
function eventToImplementType(event: string): ImplementType | null {
  if (event === "SHOT_PUT") return "SHOT";
  if (event === "HAMMER" || event === "DISCUS" || event === "JAVELIN") return event;
  return null;
}

// POST /api/throws/practice/[sessionId]/attempts — log a new attempt
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coach access required" }, { status: 403 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 }
      );
    }

    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    if (session.status === "CLOSED") {
      return NextResponse.json({ success: false, error: "Session is closed" }, { status: 400 });
    }

    const parsed = await parseBody(request, PracticeAttemptCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { athleteId, event, implement, distance, drillType, coachNote, videoUrl, attemptNumber } =
      parsed;

    // Verify coach owns this athlete
    const authorized = await canAccessAthlete(
      currentUser.userId,
      currentUser.role as "COACH" | "ATHLETE",
      athleteId
    );
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized to log attempts for this athlete" },
        { status: 403 }
      );
    }

    // Resolve catalog implementId before creation so the row lands
    // catalog-keyed from day one (no later backfill needed).
    const implementKg = parseImplementKg(implement);
    let implementId: string | null = null;
    const throwType = eventToImplementType(event);
    if (throwType && implementKg != null && implementKg > 0) {
      const isLb = /lbs?\b/i.test(implement);
      const match = await findCatalogMatchForWeight(implementKg, throwType, {
        unitSystem: isLb ? "imperial" : "metric",
      });
      if (match.kind === "exact" || match.kind === "tolerated") {
        implementId = match.implement.id;
      }
    }

    // Auto-detect PR: atomic write via canonical recordThrow helper.
    let isPR = false;
    let previousBest: number | null = null;
    let previousBestDate: string | null = null;
    if (distance !== undefined && distance !== null && implementKg != null && implementKg > 0) {
      const prResult = await recordThrow({
        athleteId,
        event,
        implementWeightKg: implementKg,
        implementLabel: implement,
        distance,
      });
      isPR = prResult.isPersonalBest;
      previousBest = prResult.previousDistance;
      previousBestDate = prResult.previousAchievedAt;
    }

    const attempt = await prisma.practiceAttempt.create({
      data: {
        sessionId: sessionId,
        athleteId,
        event: event as EventType,
        implement,
        implementId,
        distance: distance ?? null,
        drillType: drillType || null,
        coachNote: coachNote || null,
        videoUrl: videoUrl || null,
        isPR,
        attemptNumber: attemptNumber ?? 1,
      },
      include: {
        athlete: {
          select: {
            id: true,
            avatarUrl: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    // Update the catalog PR rollup so the trends widget + dashboard tile
    // reflect this attempt immediately.
    if (implementId && distance !== undefined && distance !== null) {
      await prisma.$transaction(
        async (tx) => recomputeAthleteImplementPR(tx, athleteId, implementId!),
        { timeout: 30_000 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { ...attempt, previousBest, previousBestDate },
    });
  } catch (error) {
    logger.error("POST /api/throws/practice/[sessionId]/attempts error", {
      context: "throws/practice/attempts",
      error: error,
    });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
