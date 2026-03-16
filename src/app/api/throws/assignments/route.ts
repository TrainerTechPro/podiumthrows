import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, ThrowsAssignmentCreateSchema } from "@/lib/api-schemas";

// POST /api/throws/assignments — assign a throws session to athletes
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coach access required" }, { status: 403 });
    }

    const parsed = await parseBody(req, ThrowsAssignmentCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { sessionId, athleteIds, assignedDate } = parsed;

    // Verify the session belongs to this coach
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
    }
    const session = await prisma.throwsSession.findUnique({
      where: { id: sessionId },
      select: { coachId: true },
    });
    if (!session || session.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    // Verify the coach manages all specified athletes
    for (const athleteId of athleteIds) {
      if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const assignments = await prisma.throwsAssignment.createMany({
      data: athleteIds.map((athleteId: string) => ({
        sessionId,
        athleteId,
        assignedDate,
        status: "ASSIGNED",
      })),
    });

    return NextResponse.json({ success: true, data: { count: assignments.count } });
  } catch (error) {
    logger.error("POST /api/throws/assignments error", { context: "throws/assignments", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/throws/assignments — get assignments (for athlete: their own, for coach: all)
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const athleteId = searchParams.get("athleteId");

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      include: { athleteProfile: true, coachProfile: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    let whereClause: Record<string, unknown> = {};

    if (user.role === "ATHLETE" && user.athleteProfile) {
      whereClause = { athleteId: user.athleteProfile.id };
    } else if (user.role === "COACH" && user.coachProfile) {
      whereClause = athleteId
        ? { athleteId, session: { coachId: user.coachProfile.id } }
        : { session: { coachId: user.coachProfile.id } };
    }

    const assignments = await prisma.throwsAssignment.findMany({
      where: whereClause,
      include: {
        session: {
          include: { blocks: { orderBy: { position: "asc" } } },
        },
        athlete: {
          include: { user: { select: { id: true, email: true } } },
        },
        throwLogs: { orderBy: { throwNumber: "asc" } },
      },
      orderBy: { assignedDate: "desc" },
    });

    return NextResponse.json({ success: true, data: assignments });
  } catch (error) {
    logger.error("GET /api/throws/assignments error", { context: "throws/assignments", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
