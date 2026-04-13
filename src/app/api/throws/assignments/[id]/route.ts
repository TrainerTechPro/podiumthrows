import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { emitSessionComplete } from "@/lib/team-activity";
import { parseBody, ThrowsAssignmentUpdateSchema } from "@/lib/api-schemas";

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
          select: {
            id: true,
            name: true,
            tags: true,
            blocks: { orderBy: { position: "asc" } },
            coach: { select: { id: true } },
          },
        },
        athlete: {
          select: { id: true, firstName: true, lastName: true, coachId: true, currentStreak: true, longestStreak: true },
        },
        throwLogs: { orderBy: { throwNumber: "asc" } },
      },
    });

    // ── Post-completion: streak + notification ─────────────────────
    if (action === "complete" || action === "partial") {
      // Update athlete streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const yesterdayAssignment = await prisma.throwsAssignment.findFirst({
        where: {
          athleteId: updated.athleteId,
          status: "COMPLETED",
          completedAt: { gte: yesterday, lt: todayStart },
        },
        select: { id: true },
      });

      const currentStreak = updated.athlete.currentStreak ?? 0;
      const longestStreak = updated.athlete.longestStreak ?? 0;
      const newStreak = yesterdayAssignment ? currentStreak + 1 : 1;

      await prisma.athleteProfile.update({
        where: { id: updated.athleteId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(longestStreak, newStreak),
        },
      });

      // Fire WORKOUT_COMPLETED notification to coach
      const coachId = updated.athlete.coachId ?? updated.session.coach?.id;
      if (coachId) {
        const athleteName = [updated.athlete.firstName, updated.athlete.lastName]
          .filter(Boolean)
          .join(" ") || "Athlete";
        const totalThrows = updated.throwLogs.length;
        const bestMark = updated.throwLogs.reduce(
          (max, tl) => (tl.distance && tl.distance > max ? tl.distance : max),
          0,
        );
        const sessionRpe = rpe as number | undefined;

        void createNotification({
          type: "WORKOUT_COMPLETED",
          coachId,
          athleteProfileId: updated.athleteId,
          title: `${athleteName} completed ${updated.session.name}`,
          body: `RPE: ${sessionRpe ?? "—"}/10 | Best: ${bestMark > 0 ? bestMark.toFixed(2) + "m" : "—"} | ${totalThrows} throws`,
          metadata: {
            assignmentId: updated.id,
            bestMark,
            rpe: sessionRpe,
            selfFeeling,
            totalThrows,
            url: `/coach/athletes`,
          },
        }).catch((err) => logger.error("Workout completion notification failed", { error: err }));
      }

      // Emit team feed SESSION entry (fire-and-forget). PR events for individual
      // throws were already emitted at log-throw time — this row covers the
      // session completion itself.
      void emitSessionComplete(updated.athleteId, {
        throwCount: updated.throwLogs.length,
        bestDistance: updated.throwLogs.reduce(
          (max, tl) => (tl.distance && tl.distance > max ? tl.distance : max),
          0
        ) || null,
        sessionId: updated.id,
      }).catch((err) => logger.error("Team activity session emit failed", { error: err }));
    }

    // ── Update self-program ProgramSession if this was auto-created ───
    if (action === "complete" || action === "partial") {
      try {
        const tags = updated.session.tags ? JSON.parse(updated.session.tags) : [];
        const selfProgramTag = (tags as string[]).find((t: string) => t.startsWith("selfProgram:"));
        if (selfProgramTag) {
          const programSessionId = selfProgramTag.replace("selfProgram:", "");
          const bestMark = updated.throwLogs.reduce(
            (max: number, tl: { distance: number | null }) => (tl.distance && tl.distance > max ? tl.distance : max),
            0,
          );
          await prisma.programSession.update({
            where: { id: programSessionId },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              actualThrows: updated.throwLogs.length,
              bestMark: bestMark > 0 ? bestMark : undefined,
              rpe: (rpe as number) ?? undefined,
              selfFeeling: (selfFeeling as string) ?? undefined,
            },
          });
        }
      } catch (err) {
        // Non-critical — don't fail the assignment completion
        logger.error("Failed to update self-program session", { context: "api", error: err });
      }
    }

    // Fire WORKOUT_SKIPPED notification to coach
    if (action === "skip") {
      const coachId = updated.athlete?.coachId ?? updated.session.coach?.id;
      if (coachId) {
        const athleteName = [updated.athlete?.firstName, updated.athlete?.lastName]
          .filter(Boolean)
          .join(" ") || "Athlete";
        void createNotification({
          type: "WORKOUT_SKIPPED",
          coachId,
          athleteProfileId: updated.athleteId,
          title: `${athleteName} skipped ${updated.session.name}`,
          body: skipReason ? `Reason: ${skipReason}` : "No reason provided",
          metadata: { assignmentId: updated.id, skipReason },
        }).catch((err) => logger.error("Workout skip notification failed", { error: err }));
      }
    }

    // Invalidate cached data so other widgets update without a page refresh
    revalidateTag(`athlete-${updated.athleteId}`);
    const coachIdForTag = updated.athlete?.coachId ?? updated.session.coach?.id;
    if (coachIdForTag) revalidateTag(`coach-${coachIdForTag}`);

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
