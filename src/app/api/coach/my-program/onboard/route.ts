/**
 * GET /api/coach/my-program/onboard
 *
 * Fetches existing coach data to pre-populate the onboarding wizard.
 * Returns typing, lifting PRs, competition PR, current volume, preferred event.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "COACH") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 },
      );
    }

    // Fetch all prefill data in parallel
    const [typing, latestTesting, prs, sessionStats] = await Promise.all([
      // CoachTyping
      prisma.coachTyping.findUnique({
        where: { coachId: coach.id },
        select: {
          adaptationGroup: true,
          transferType: true,
          recommendedMethod: true,
          sessionsToForm: true,
          selfFeelingAccuracy: true,
          recoveryProfile: true,
        },
      }),
      // Latest CoachTestingRecord
      prisma.coachTestingRecord.findFirst({
        where: { coachId: coach.id },
        orderBy: { testDate: "desc" },
        select: {
          squatKg: true,
          benchKg: true,
          snatchKg: true,
          cleanKg: true,
          ohpKg: true,
          rdlKg: true,
          bodyWeightKg: true,
          competitionMark: true,
          event: true,
        },
      }),
      // Competition PRs
      prisma.coachPR.findMany({
        where: { coachId: coach.id },
        orderBy: { distance: "desc" },
        select: {
          event: true,
          implement: true,
          distance: true,
        },
      }),
      // Session count and last 12 weeks volume
      prisma.coachThrowsSession.findMany({
        where: {
          coachId: coach.id,
          date: {
            gte: new Date(Date.now() - 84 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10),
          },
        },
        select: {
          event: true,
          date: true,
          drillLogs: {
            select: { throwCount: true },
          },
        },
      }),
    ]);

    // Determine preferred event (most frequent from recent sessions)
    const eventCounts: Record<string, number> = {};
    let totalThrows = 0;
    for (const session of sessionStats) {
      eventCounts[session.event] = (eventCounts[session.event] || 0) + 1;
      for (const log of session.drillLogs) {
        totalThrows += log.throwCount ?? 0;
      }
    }
    const preferredEvent =
      Object.entries(eventCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Estimate weekly volume from recent sessions
    const weeksCount = Math.max(1, sessionStats.length > 0 ? 12 : 1);
    const currentVolume =
      sessionStats.length > 0 ? Math.round(totalThrows / weeksCount) : null;

    // Get best competition PR per event
    const bestPrByEvent: Record<string, number> = {};
    for (const pr of prs) {
      if (!bestPrByEvent[pr.event] || pr.distance > bestPrByEvent[pr.event]) {
        bestPrByEvent[pr.event] = pr.distance;
      }
    }

    // Build lifting PRs from latest testing record
    const liftingPrs = latestTesting
      ? {
          squatKg: latestTesting.squatKg,
          benchKg: latestTesting.benchKg,
          cleanKg: latestTesting.cleanKg,
          snatchKg: latestTesting.snatchKg,
          ohpKg: latestTesting.ohpKg,
          rdlKg: latestTesting.rdlKg,
          bodyWeightKg: latestTesting.bodyWeightKg,
        }
      : null;

    return NextResponse.json({
      success: true,
      data: {
        typing: typing
          ? {
              adaptationGroup: typing.adaptationGroup,
              transferType: typing.transferType,
              recommendedMethod: typing.recommendedMethod,
              sessionsToForm: typing.sessionsToForm,
              selfFeelingAccuracy: typing.selfFeelingAccuracy,
              recoveryProfile: typing.recoveryProfile,
            }
          : null,
        liftingPrs,
        competitionPrs: bestPrByEvent,
        currentVolume,
        preferredEvent,
        sessionCount: sessionStats.length,
        hasTyping: !!typing,
      },
    });
  } catch (error) {
    logger.error("Coach my-program onboard prefill error", {
      context: "coach/my-program/onboard",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to load prefill data" },
      { status: 500 },
    );
  }
}
