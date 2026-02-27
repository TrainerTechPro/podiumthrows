import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

// PUT /api/throws/assignments/[id] — update assignment status (start, complete, skip)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, rpe, selfFeeling, feedbackNotes, skipReason, completedBlockIds } = body;

    // Verify the assignment belongs to this athlete
    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      include: { athleteProfile: true },
    });

    if (!user?.athleteProfile) {
      return NextResponse.json({ success: false, error: "Athlete profile not found" }, { status: 403 });
    }

    const assignment = await prisma.throwsAssignment.findUnique({
      where: { id },
    });

    if (!assignment || assignment.athleteId !== user.athleteProfile.id) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case "start":
        updateData = {
          status: "IN_PROGRESS",
          startedAt: new Date(),
        };
        break;

      case "complete":
        updateData = {
          status: "COMPLETED",
          completedAt: new Date(),
          ...(rpe !== undefined && { rpe }),
          ...(selfFeeling && { selfFeeling }),
          ...(feedbackNotes && { feedbackNotes }),
        };
        break;

      case "partial":
        updateData = {
          status: "PARTIAL",
          completedAt: new Date(),
          ...(rpe !== undefined && { rpe }),
          ...(selfFeeling && { selfFeeling }),
          ...(feedbackNotes && { feedbackNotes }),
        };
        break;

      case "skip":
        updateData = {
          status: "SKIPPED",
          ...(skipReason && { skipReason }),
        };
        break;

      case "update_blocks":
        // Store completed block IDs in feedbackNotes as a JSON prefix
        // This allows persistence without schema changes
        if (completedBlockIds) {
          const existing = assignment.feedbackNotes || "";
          const blockData = JSON.stringify({ completedBlockIds });
          // Store block progress as a metadata prefix separated by |||
          const userNotes = existing.includes("|||") ? existing.split("|||")[1] : existing;
          updateData = {
            feedbackNotes: blockData + "|||" + userNotes,
          };
        }
        break;

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    const updated = await prisma.throwsAssignment.update({
      where: { id },
      data: updateData,
      include: {
        session: {
          include: { blocks: { orderBy: { position: "asc" } } },
        },
        throwLogs: { orderBy: { throwNumber: "asc" } },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error("PUT /api/throws/assignments/[id] error", { context: "throws/assignments", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/throws/assignments/[id] — get a single assignment with full details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const assignment = await prisma.throwsAssignment.findUnique({
      where: { id },
      include: {
        session: {
          include: { blocks: { orderBy: { position: "asc" } } },
        },
        athlete: {
          include: { user: { select: { id: true, email: true } } },
        },
        throwLogs: { orderBy: { throwNumber: "asc" } },
      },
    });

    if (!assignment) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    // Verify the caller has access to this assignment's athlete
    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", assignment.athlete.id))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: assignment });
  } catch (error) {
    logger.error("GET /api/throws/assignments/[id] error", { context: "throws/assignments", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
