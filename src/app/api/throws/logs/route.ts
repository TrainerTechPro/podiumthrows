import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, ThrowsBlockLogCreateSchema } from "@/lib/api-schemas";

// POST /api/throws/logs — log throws for a block (batch create/upsert)
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const parsed = await parseBody(req, ThrowsBlockLogCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { assignmentId, blockId, throws } = parsed;

    // Verify the assignment belongs to this athlete
    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: { athleteProfile: { select: { id: true } } },
    });

    if (!user?.athleteProfile) {
      return NextResponse.json({ success: false, error: "Athlete profile not found" }, { status: 403 });
    }

    const assignment = await prisma.throwsAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment || assignment.athleteId !== user.athleteProfile.id) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    // Atomically delete existing logs and create fresh ones
    const throwLogs = await prisma.$transaction(async (tx) => {
      await tx.throwsBlockLog.deleteMany({
        where: { assignmentId, blockId },
      });

      return tx.throwsBlockLog.createMany({
        data: throws.map((t) => ({
          assignmentId,
          blockId,
          throwNumber: t.throwNumber,
          distance: t.distance,
          implement: t.implement,
          notes: t.notes || null,
        })),
      });
    });

    return NextResponse.json({ success: true, data: { count: throwLogs.count } });
  } catch (error) {
    logger.error("POST /api/throws/logs error", { context: "throws/logs", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/throws/logs — get throw logs for an assignment
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get("assignmentId");

    if (!assignmentId) {
      return NextResponse.json({ success: false, error: "assignmentId is required" }, { status: 400 });
    }

    // Verify caller has access to this assignment's athlete
    const assignment = await prisma.throwsAssignment.findUnique({
      where: { id: assignmentId },
      select: { athleteId: true },
    });
    if (!assignment) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }
    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", assignment.athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const logs = await prisma.throwsBlockLog.findMany({
      where: { assignmentId },
      orderBy: [{ blockId: "asc" }, { throwNumber: "asc" }],
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    logger.error("GET /api/throws/logs error", { context: "throws/logs", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
