import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, canActAsAthlete } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { emitPR } from "@/lib/team-activity";
import { parseBody, ThrowsPrCheckSchema } from "@/lib/api-schemas";
import { parseImplementKg } from "@/lib/throws";
import { recordThrow } from "@/lib/throws/pr";
import { EventType } from "@prisma/client";

// GET /api/throws/prs — get PRs for the current athlete (or by athleteId for coaches)
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const athleteIdParam = searchParams.get("athleteId");
    const event = searchParams.get("event");

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: { role: true, athleteProfile: { select: { id: true } } },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    let athleteId: string;

    if ((await canActAsAthlete(currentUser)) && user.athleteProfile) {
      athleteId = user.athleteProfile.id;
    } else if (user.role === "COACH" && athleteIdParam) {
      if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteIdParam))) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      athleteId = athleteIdParam;
    } else {
      return NextResponse.json({ success: false, error: "Cannot determine athlete" }, { status: 400 });
    }

    const where: Record<string, unknown> = { athleteId };
    if (event) where.event = event;

    const prs = await prisma.throwsPR.findMany({
      where,
      orderBy: [{ event: "asc" }, { distance: "desc" }],
    });

    return NextResponse.json({ success: true, data: prs });
  } catch (error) {
    logger.error("GET /api/throws/prs error", { context: "throws/prs", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/throws/prs/check — check a throw distance against current PR and update if new
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const parsed = await parseBody(req, ThrowsPrCheckSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { event, implement, distance, source, athleteId: bodyAthleteId } = parsed;

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: { role: true, athleteProfile: { select: { id: true } } },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    let athleteId: string;

    if (user.role === "COACH" && bodyAthleteId) {
      // Coach recording PR on behalf of an athlete — verify access
      if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", bodyAthleteId))) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      athleteId = bodyAthleteId;
    } else if (user.athleteProfile) {
      athleteId = user.athleteProfile.id;
    } else {
      return NextResponse.json({ success: false, error: "Athlete profile not found" }, { status: 403 });
    }

    const implementKg = parseImplementKg(implement) ?? 0;
    if (implementKg <= 0) {
      return NextResponse.json(
        { success: false, error: "Could not parse implement weight" },
        { status: 400 }
      );
    }

    const prResult = await recordThrow({
      athleteId,
      event,
      implementWeightKg: implementKg,
      implementLabel: implement,
      distance,
      source: source === "COMPETITION" ? "COMPETITION" : "TRAINING",
    });

    if (prResult.isPersonalBest) {
      // Emit team feed PR entry (fire-and-forget).
      void emitPR(athleteId, {
        event,
        implementWeight: implementKg,
        distance,
        previousDistance: prResult.previousDistance,
      }).catch((err) => logger.error("Team activity PR emit failed", { context: "throws/prs", error: err }));

      return NextResponse.json({
        success: true,
        data: {
          pr: prResult.pr,
          isNewPR: true,
          previousDistance: prResult.previousDistance,
          improvement:
            prResult.previousDistance != null
              ? +(distance - prResult.previousDistance).toFixed(2)
              : null,
        },
      });
    }

    // Not a new PR — fetch current PR row to return for caller convenience.
    const currentPR = await prisma.throwsPR.findUnique({
      where: { athleteId_event_implement: { athleteId, event: event as EventType, implement } },
    });

    return NextResponse.json({
      success: true,
      data: {
        pr: currentPR,
        isNewPR: false,
        currentBest: currentPR?.distance ?? prResult.previousDistance,
      },
    });
  } catch (error) {
    logger.error("POST /api/throws/prs error", { context: "throws/prs", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
