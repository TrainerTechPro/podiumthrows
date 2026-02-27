import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

// POST /api/throws/logs — log throws for a block (batch create/upsert)
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { assignmentId, blockId, throws } = body;

    if (!assignmentId || !blockId || !throws?.length) {
      return NextResponse.json(
        { success: false, error: "assignmentId, blockId, and throws array are required" },
        { status: 400 }
      );
    }

    // Verify the assignment belongs to this athlete
    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      include: { athleteProfile: true },
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

    // Delete existing logs for this block+assignment, then create fresh ones
    await prisma.throwsBlockLog.deleteMany({
      where: { assignmentId, blockId },
    });

    const throwLogs = await prisma.throwsBlockLog.createMany({
      data: throws.map((t: { throwNumber: number; distance: number | null; implement: string; notes?: string }) => ({
        assignmentId,
        blockId,
        throwNumber: t.throwNumber,
        distance: t.distance,
        implement: t.implement,
        notes: t.notes || null,
      })),
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
