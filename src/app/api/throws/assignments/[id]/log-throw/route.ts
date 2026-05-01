import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseImplementKg } from "@/lib/throws";
import { recordThrow } from "@/lib/throws/pr";
import { findCatalogMatchForWeight, recomputeAthleteImplementPR } from "@/lib/implements";
import { notifyCoachPR } from "@/lib/notifications";
import { awardPRAchievement } from "@/lib/achievements";
import { emitPR } from "@/lib/team-activity";
import type { ImplementType } from "@prisma/client";

/** EventType (SHOT_PUT) → ImplementType (SHOT). */
function eventToImplementType(event: string): ImplementType | null {
  if (event === "SHOT_PUT") return "SHOT";
  if (event === "HAMMER" || event === "DISCUS" || event === "JAVELIN") return event;
  return null;
}

/**
 * POST /api/throws/assignments/[id]/log-throw
 *
 * Logs a single throw for a ThrowsBlock within an assignment.
 * Runs PR detection and fires coach notification on new PRs.
 *
 * Body: { blockId, distance, implement, throwNumber, event?, notes? }
 * Returns: { throwLog, isPersonalBest }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { id: assignmentId } = await params;

    // Verify the assignment belongs to this athlete
    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      include: {
        athleteProfile: {
          select: { id: true, coachId: true, firstName: true, lastName: true },
        },
      },
    });

    if (!user?.athleteProfile) {
      return NextResponse.json(
        { success: false, error: "Athlete profile required" },
        { status: 403 }
      );
    }

    const assignment = await prisma.throwsAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        athleteId: true,
        status: true,
        sessionId: true,
        session: { select: { event: true } },
      },
    });

    if (!assignment || assignment.athleteId !== user.athleteProfile.id) {
      return NextResponse.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    // Only allow logging for active assignments
    if (assignment.status !== "IN_PROGRESS" && assignment.status !== "ASSIGNED") {
      return NextResponse.json(
        { success: false, error: "Assignment is not active" },
        { status: 409 }
      );
    }

    // Auto-transition to IN_PROGRESS on first log
    if (assignment.status === "ASSIGNED") {
      await prisma.throwsAssignment.update({
        where: { id: assignmentId },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });
    }

    const body = await req.json();
    const { blockId, distance, implement, throwNumber, notes } = body;

    if (!blockId || typeof throwNumber !== "number") {
      return NextResponse.json(
        { success: false, error: "blockId and throwNumber are required" },
        { status: 400 }
      );
    }

    // Verify block belongs to assignment's session
    const block = await prisma.throwsBlock.findUnique({
      where: { id: blockId },
      select: { id: true, sessionId: true, blockType: true },
    });

    if (!block) {
      return NextResponse.json({ success: false, error: "Block not found" }, { status: 404 });
    }

    // Verify block belongs to this assignment's session
    if (block.sessionId !== assignment.sessionId) {
      return NextResponse.json(
        { success: false, error: "Block does not belong to this session" },
        { status: 403 }
      );
    }

    // Resolve catalog implementId before insert so this row lands
    // catalog-keyed from day one. Pulls the event off the parent session.
    const event = assignment.session.event;
    const implementKgForCatalog = parseImplementKg(implement);
    let implementId: string | null = null;
    const throwType = event ? eventToImplementType(event) : null;
    if (throwType && implementKgForCatalog != null && implementKgForCatalog > 0) {
      const isLb = typeof implement === "string" && /lbs?\b/i.test(implement);
      const match = await findCatalogMatchForWeight(implementKgForCatalog, throwType, {
        unitSystem: isLb ? "imperial" : "metric",
      });
      if (match.kind === "exact" || match.kind === "tolerated") {
        implementId = match.implement.id;
      }
    }

    // Create the throw log
    const throwLog = await prisma.throwsBlockLog.create({
      data: {
        assignmentId,
        blockId,
        throwNumber,
        distance: typeof distance === "number" ? distance : null,
        implement: implement ?? "",
        implementId,
        notes: notes ?? null,
      },
    });

    // Update catalog PR rollup so trends widget + dashboard reflect this
    // throw immediately. Skipped when implementId couldn't be resolved
    // (the Fix UI will surface those rows for cleanup).
    const athleteProfileId = user.athleteProfile.id;
    if (implementId && typeof distance === "number" && distance > 0) {
      await prisma.$transaction(
        async (tx) => recomputeAthleteImplementPR(tx, athleteProfileId, implementId!),
        { timeout: 30_000 }
      );
    }

    // PR detection (only for throws with valid distance)
    let isPersonalBest = false;
    let previousBest: number | null = null;
    let previousBestDate: string | null = null;
    if (typeof distance === "number" && distance > 0) {
      const event = assignment.session.event;
      const implementKg = parseImplementKg(implement);

      if (event && implementKg != null && implementKg > 0) {
        const prResult = await recordThrow({
          athleteId: user.athleteProfile.id,
          event,
          implementWeightKg: implementKg,
          distance,
        });
        isPersonalBest = prResult.isPersonalBest;
        previousBest = prResult.previousDistance;
        previousBestDate = prResult.previousAchievedAt;

        if (isPersonalBest) {
          // Fire coach notification (fire-and-forget)
          if (user.athleteProfile.coachId) {
            const name =
              [user.athleteProfile.firstName, user.athleteProfile.lastName]
                .filter(Boolean)
                .join(" ") ||
              user.email ||
              "Athlete";
            void notifyCoachPR(
              user.athleteProfile.coachId,
              user.athleteProfile.id,
              name,
              event,
              distance
            ).catch((err) => logger.error("PR notification failed", { error: err }));
          }

          // Award PR achievement (fire-and-forget)
          void awardPRAchievement(user.athleteProfile.id, event).catch((err) =>
            logger.error("PR achievement failed", { error: err })
          );

          // Emit team activity feed entry (fire-and-forget)
          void emitPR(user.athleteProfile.id, {
            event,
            implementWeight: implementKg,
            distance,
            previousDistance: prResult.previousDistance,
          }).catch((err) => logger.error("Team activity PR emit failed", { error: err }));
        }
      }
    }

    // Invalidate cached data so other widgets update without a page refresh
    revalidateTag(`athlete-${user.athleteProfile.id}`);
    if (user.athleteProfile.coachId) revalidateTag(`coach-${user.athleteProfile.coachId}`);

    return NextResponse.json({
      success: true,
      data: { throwLog, isPersonalBest, previousBest, previousBestDate },
    });
  } catch (error) {
    logger.error("POST /api/throws/assignments/[id]/log-throw error", { error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
