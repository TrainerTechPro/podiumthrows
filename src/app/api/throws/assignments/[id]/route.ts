import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, ThrowsAssignmentUpdateSchema } from "@/lib/api-schemas";
import { onSessionComplete, type TerminalStatus } from "@/lib/sessions/on-session-complete";

function resolveTerminalStatus(
  action: "start" | "complete" | "partial" | "skip" | "update_blocks"
): TerminalStatus | null {
  if (action === "complete") return "completed";
  if (action === "partial") return "partial";
  if (action === "skip") return "skipped";
  return null;
}

// PUT /api/throws/assignments/[id] — update assignment status (start, complete, skip)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const parsed = await parseBody(req, ThrowsAssignmentUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;

    // Narrow the discriminated union into the legacy variable names so the
    // post-completion blocks below (streak update, notifications, self-program
    // sync) can access fields without per-case narrowing.
    const action = parsed.action;
    const rpe = "rpe" in parsed ? parsed.rpe : undefined;
    const selfFeeling = "selfFeeling" in parsed ? parsed.selfFeeling : undefined;
    const feedbackNotes = "feedbackNotes" in parsed ? parsed.feedbackNotes : undefined;
    const skipReason = "skipReason" in parsed ? parsed.skipReason : undefined;
    const completedBlockIds = "completedBlockIds" in parsed ? parsed.completedBlockIds : undefined;

    // Verify the assignment belongs to this athlete
    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      include: { athleteProfile: true },
    });

    if (!user?.athleteProfile) {
      return NextResponse.json(
        { success: false, error: "Athlete profile not found" },
        { status: 403 }
      );
    }

    const assignment = await prisma.throwsAssignment.findUnique({
      where: { id },
    });

    if (!assignment || assignment.athleteId !== user.athleteProfile.id) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};
    // Branch hint the server-side post-completion logic uses to decide if
    // streak + notifications fire. "end" resolves to either "partial" or
    // "skip" below based on log count; track the resolution so the
    // post-hooks key off the right effective action.
    let effectiveAction: "start" | "complete" | "partial" | "skip" | "update_blocks" = action as
      | "start"
      | "complete"
      | "partial"
      | "skip"
      | "update_blocks";

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

      case "end": {
        // Escape hatch for a stuck IN_PROGRESS row. 0 logs = SKIPPED (nothing
        // happened), 1+ logs = PARTIAL (they did some of it, just never hit
        // Complete). Streak + notification logic below gates on effectiveAction.
        if (
          assignment.status !== "IN_PROGRESS" &&
          assignment.status !== "ASSIGNED" &&
          assignment.status !== "NOTIFIED"
        ) {
          return NextResponse.json(
            { success: false, error: "Session is already finished" },
            { status: 409 }
          );
        }
        const throwCount = await prisma.throwsBlockLog.count({
          where: { assignmentId: id },
        });
        if (throwCount > 0) {
          updateData = { status: "PARTIAL", completedAt: new Date() };
          effectiveAction = "partial";
        } else {
          updateData = { status: "SKIPPED" };
          effectiveAction = "skip";
        }
        break;
      }

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
          select: {
            id: true,
            name: true,
            tags: true,
            blocks: { orderBy: { position: "asc" } },
            coach: { select: { id: true } },
          },
        },
        athlete: {
          select: {
            firstName: true,
            lastName: true,
            coachId: true,
          },
        },
        throwLogs: { orderBy: { throwNumber: "asc" } },
      },
    });

    const terminalStatus = resolveTerminalStatus(effectiveAction);
    if (terminalStatus) {
      const bestMark = updated.throwLogs.reduce(
        (max, tl) => (tl.distance && tl.distance > max ? tl.distance : max),
        0
      );
      const athleteName =
        [updated.athlete.firstName, updated.athlete.lastName].filter(Boolean).join(" ") ||
        "Athlete";

      await onSessionComplete({
        athleteId: updated.athleteId,
        coachId: updated.athlete.coachId ?? updated.session.coach?.id ?? null,
        source: "assigned-throws",
        sourceId: updated.id,
        terminalStatus,
        completedAt: updated.completedAt ?? new Date(),
        sessionTitle: updated.session.name,
        athleteName,
        sessionTags: updated.session.tags,
        metrics: {
          throwCount: updated.throwLogs.length,
          bestMarkM: bestMark > 0 ? bestMark : null,
          rpe: (rpe as number | undefined) ?? null,
          selfFeeling: (selfFeeling as string | undefined) ?? null,
        },
        skipReason: (skipReason as string | undefined) ?? null,
      });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error("PUT /api/throws/assignments/[id] error", {
      context: "throws/assignments",
      error: error,
    });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/throws/assignments/[id] — get a single assignment with full details
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        assignment.athlete.id
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: assignment });
  } catch (error) {
    logger.error("GET /api/throws/assignments/[id] error", {
      context: "throws/assignments",
      error: error,
    });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
