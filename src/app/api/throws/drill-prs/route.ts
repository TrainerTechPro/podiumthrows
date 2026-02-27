import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

// GET /api/throws/drill-prs?athleteId=...
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const athleteIdParam = searchParams.get("athleteId");

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      include: { athleteProfile: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const athleteId = user.role === "ATHLETE" && user.athleteProfile
      ? user.athleteProfile.id
      : athleteIdParam;

    if (!athleteId) {
      return NextResponse.json({ success: false, error: "athleteId required" }, { status: 400 });
    }

    if (user.role !== "ATHLETE" && !(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const drillPRs = await prisma.throwsDrillPR.findMany({
      where: { athleteId },
      orderBy: [{ event: "asc" }, { drillType: "asc" }, { distance: "desc" }],
    });

    return NextResponse.json({ success: true, data: drillPRs });
  } catch (error) {
    logger.error("GET /api/throws/drill-prs error", { context: "throws/drill-prs", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/throws/drill-prs — upsert a drill PR (keeps best distance only)
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { athleteId: bodyAthleteId, event, drillType, implement, distance, achievedAt, notes } = body;

    if (!event || !drillType || !implement || distance == null) {
      return NextResponse.json(
        { success: false, error: "event, drillType, implement, and distance are required" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      include: { athleteProfile: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const athleteId = user.role === "COACH" && bodyAthleteId
      ? bodyAthleteId
      : user.athleteProfile?.id;

    if (!athleteId) {
      return NextResponse.json({ success: false, error: "Cannot determine athlete" }, { status: 400 });
    }

    if (user.role !== "ATHLETE" && !(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.throwsDrillPR.findUnique({
      where: { athleteId_event_drillType_implement: { athleteId, event, drillType, implement } },
    });

    const isNewPR = !existing || distance > existing.distance;
    const today = new Date().toISOString().split("T")[0];

    const pr = await prisma.throwsDrillPR.upsert({
      where: { athleteId_event_drillType_implement: { athleteId, event, drillType, implement } },
      update: isNewPR
        ? { distance, achievedAt: achievedAt || today, notes: notes ?? existing?.notes }
        : {},
      create: {
        athleteId,
        event,
        drillType,
        implement,
        distance,
        achievedAt: achievedAt || today,
        notes,
      },
    });

    return NextResponse.json({
      success: true,
      data: { pr, isNewPR, previousDistance: existing?.distance ?? null },
    });
  } catch (error) {
    logger.error("POST /api/throws/drill-prs error", { context: "throws/drill-prs", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
