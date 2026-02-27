import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

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
      include: { athleteProfile: true, coachProfile: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    let athleteId: string;

    if (user.role === "ATHLETE" && user.athleteProfile) {
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

    const body = await req.json();
    const { event, implement, distance, source, athleteId: bodyAthleteId } = body;

    if (!event || !implement || !distance) {
      return NextResponse.json(
        { success: false, error: "event, implement, and distance are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      include: { athleteProfile: true, coachProfile: true },
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

    // Check existing PR
    const existingPR = await prisma.throwsPR.findUnique({
      where: { athleteId_event_implement: { athleteId, event, implement } },
    });

    const isNewPR = !existingPR || distance > existingPR.distance;
    const today = new Date().toISOString().split("T")[0];

    if (isNewPR) {
      const pr = await prisma.throwsPR.upsert({
        where: { athleteId_event_implement: { athleteId, event, implement } },
        update: {
          distance,
          achievedAt: today,
          source: source || "TRAINING",
        },
        create: {
          athleteId,
          event,
          implement,
          distance,
          achievedAt: today,
          source: source || "TRAINING",
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          pr,
          isNewPR: true,
          previousDistance: existingPR?.distance || null,
          improvement: existingPR ? +(distance - existingPR.distance).toFixed(2) : null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        pr: existingPR,
        isNewPR: false,
        currentBest: existingPR.distance,
      },
    });
  } catch (error) {
    logger.error("POST /api/throws/prs error", { context: "throws/prs", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
