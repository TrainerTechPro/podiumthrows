import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, canActAsAthlete } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, ThrowsAssignmentCreateSchema } from "@/lib/api-schemas";
import { createNotification } from "@/lib/notifications";
import { getAssessmentStatus } from "@/lib/bondarchuk/assessment-status";

// POST /api/throws/assignments — assign a throws session to athletes
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coach access required" }, { status: 403 });
    }

    const parsed = await parseBody(req, ThrowsAssignmentCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { sessionId, athleteIds, assignedDate, overrideAssessment, overrideReason } = parsed;

    // Verify the session belongs to this coach
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 }
      );
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
      if (
        !(await canAccessAthlete(
          currentUser.userId,
          currentUser.role as "COACH" | "ATHLETE",
          athleteId
        ))
      ) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    // ── Bondarchuk assessment staleness gate ─────────────────────────────
    // Exercise programming depends on athlete type classification, which
    // decays as athletes adapt. Block assign for `expired` (>90d) unless
    // the coach explicitly overrides; block `never` with no override path.
    const latestAssessments = await prisma.bondarchukAssessment.findMany({
      where: { athleteId: { in: athleteIds } },
      select: { athleteId: true, completedAt: true },
      orderBy: { completedAt: "desc" },
    });
    const latestByAthlete = new Map<string, Date>();
    for (const a of latestAssessments) {
      if (!latestByAthlete.has(a.athleteId)) latestByAthlete.set(a.athleteId, a.completedAt);
    }

    const blocked: Array<{ athleteId: string; tier: string; days: number }> = [];
    const expiredIds: Array<{ athleteId: string; days: number }> = [];
    for (const athleteId of athleteIds) {
      const status = getAssessmentStatus(latestByAthlete.get(athleteId) ?? null);
      if (status.tier === "never") {
        blocked.push({ athleteId, tier: "never", days: 0 });
      } else if (status.tier === "expired") {
        if (!overrideAssessment) {
          blocked.push({ athleteId, tier: "expired", days: status.days });
        } else {
          expiredIds.push({ athleteId, days: status.days });
        }
      }
    }
    if (blocked.length > 0) {
      const neverCount = blocked.filter((b) => b.tier === "never").length;
      const expiredCount = blocked.filter((b) => b.tier === "expired").length;
      const summary =
        neverCount > 0 && expiredCount > 0
          ? `${neverCount} athlete(s) have never been assessed and ${expiredCount} have expired assessments (>90d)`
          : neverCount > 0
            ? `${neverCount} athlete(s) have never been assessed — run Bondarchuk assessment before programming`
            : `${expiredCount} athlete(s) have expired assessments (>90d) — override required`;
      return NextResponse.json(
        {
          success: false,
          error: summary,
          code: "ASSESSMENT_STALE",
          blockedAthletes: blocked,
        },
        { status: 400 }
      );
    }

    // Write override audit rows (one per expired athlete in this batch).
    if (expiredIds.length > 0) {
      await prisma.assessmentOverride.createMany({
        data: expiredIds.map(({ athleteId, days }) => ({
          coachId: coach.id,
          athleteId,
          assessmentDaysStale: days,
          reason: overrideReason ?? null,
        })),
      });
    }

    const assignments = await prisma.throwsAssignment.createMany({
      data: athleteIds.map((athleteId: string) => ({
        sessionId,
        athleteId,
        assignedDate,
        status: "ASSIGNED",
      })),
    });

    // Fetch session name for notification body
    const sessionDetails = await prisma.throwsSession.findUnique({
      where: { id: sessionId },
      select: { name: true },
    });
    const sessionName = sessionDetails?.name ?? "Workout";

    // Fetch created assignments to get IDs for notification metadata
    const createdAssignments = await prisma.throwsAssignment.findMany({
      where: { sessionId, assignedDate, athleteId: { in: athleteIds } },
      select: { id: true, athleteId: true },
      orderBy: { createdAt: "desc" },
      take: athleteIds.length,
    });

    // Fire WORKOUT_ASSIGNED notification per athlete (fire-and-forget)
    const dateLabel = new Date(assignedDate + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    for (const a of createdAssignments) {
      void createNotification({
        type: "WORKOUT_ASSIGNED",
        athleteProfileId: a.athleteId,
        title: "New workout assigned",
        body: `${sessionName} scheduled for ${dateLabel}`,
        metadata: {
          assignmentId: a.id,
          sessionId,
          date: assignedDate,
          url: `/athlete/throws/${a.id}`,
        },
      }).catch((err) => logger.error("Failed to create workout notification", { error: err }));
    }

    return NextResponse.json({ success: true, data: { count: assignments.count } });
  } catch (error) {
    logger.error("POST /api/throws/assignments error", {
      context: "throws/assignments",
      error: error,
    });
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

    if ((await canActAsAthlete(currentUser)) && user.athleteProfile) {
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
    logger.error("GET /api/throws/assignments error", {
      context: "throws/assignments",
      error: error,
    });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
