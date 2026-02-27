/**
 * /api/dashboard/throws-roster-pulse
 *
 * GET — Enhanced per-athlete throws data for the coach dashboard roster table.
 * Returns roster rows augmented with:
 *   - Recent practice session stats (throws/week, implement split, days since last practice)
 *   - Latest wellness check-in (selfFeeling, energy)
 *   - Training logs count this week (strength proxy)
 *   - Best training mark from last 14 days
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coaches only" }, { status: 403 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Core roster with base data
    const roster = await prisma.throwsProfile.findMany({
      where: { enrolledBy: coach.id, status: "active" },
      include: {
        athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            throwsPRs: { select: { event: true, implement: true, distance: true } },
            // Latest check-in in last 7 days
            throwsCheckIns: {
              orderBy: { date: "desc" },
              take: 1,
              select: { date: true, selfFeeling: true, energy: true, sorenessGeneral: true },
            },
          },
        },
        testingRecords: {
          orderBy: { testDate: "desc" },
          take: 1,
          select: { testDate: true, testType: true },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });

    // Collect all athlete IDs for bulk queries
    const athleteIds = roster.map((r) => r.athleteId);
    if (athleteIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Bulk: practice attempts in last 7 days
    const practiceAttempts7d = await prisma.practiceAttempt.findMany({
      where: {
        athleteId: { in: athleteIds },
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        athleteId: true,
        implement: true,
        distance: true,
        event: true,
        session: { select: { date: true } },
      },
    });

    // Bulk: best practice attempt in last 14 days (for "recent mark")
    const recentAttempts14d = await prisma.practiceAttempt.findMany({
      where: {
        athleteId: { in: athleteIds },
        createdAt: { gte: fourteenDaysAgo },
        distance: { not: null },
      },
      select: {
        athleteId: true,
        event: true,
        distance: true,
        session: { select: { date: true } },
      },
      orderBy: { distance: "desc" },
    });

    // Bulk: most recent practice session date per athlete
    const latestPractice = await prisma.practiceAttempt.findMany({
      where: { athleteId: { in: athleteIds } },
      distinct: ["athleteId"],
      orderBy: { createdAt: "desc" },
      select: {
        athleteId: true,
        session: { select: { date: true } },
      },
    });

    // Index data by athleteId
    const attemptsByAthlete: Record<string, typeof practiceAttempts7d> = {};
    for (const a of practiceAttempts7d) {
      if (!attemptsByAthlete[a.athleteId]) attemptsByAthlete[a.athleteId] = [];
      attemptsByAthlete[a.athleteId].push(a);
    }

    const bestMark14dByAthlete: Record<string, { distance: number; date: string } | null> = {};
    for (const a of recentAttempts14d) {
      if (!bestMark14dByAthlete[a.athleteId] && a.distance != null) {
        bestMark14dByAthlete[a.athleteId] = {
          distance: a.distance,
          date: a.session.date,
        };
      }
    }

    const lastPracticeByAthlete: Record<string, string | null> = {};
    for (const a of latestPractice) {
      lastPracticeByAthlete[a.athleteId] = a.session.date;
    }

    // Implement classification helper (competition implement = standard, heavy = larger, light = smaller)
    const classifyImplement = (implement: string, event: string): "heavy" | "competition" | "light" => {
      const val = parseFloat(implement.replace(/[^0-9.]/g, "")) || 0;
      // Standard competition weights: SP M 7.26kg, F 4kg; DT M 2kg, F 1kg; HT M 7.26kg, F 4kg; JT M 800g, F 600g
      const standards: Record<string, { m: number; f: number }> = {
        SHOT_PUT: { m: 7.26, f: 4 },
        DISCUS: { m: 2, f: 1 },
        HAMMER: { m: 7.26, f: 4 },
        JAVELIN: { m: 0.8, f: 0.6 },
      };
      const std = standards[event];
      if (!std) return "competition";
      // Use 90% threshold: if within 5% of comp weight = competition, lower = light, higher = heavy
      const midpoint = std.m; // Use men's as reference; we don't have gender at attempt level
      if (val > midpoint * 1.05) return "heavy";
      if (val < midpoint * 0.9) return "light";
      return "competition";
    };

    // Build final rows
    const data = roster.map((r) => {
      const athleteAttempts = attemptsByAthlete[r.athleteId] ?? [];
      const throwsThisWeek = athleteAttempts.length;

      // Implement split
      const split = { heavy: 0, competition: 0, light: 0 };
      for (const attempt of athleteAttempts) {
        const cls = classifyImplement(attempt.implement, attempt.event);
        split[cls]++;
      }

      // Days since last practice
      const lastPracticeDate = lastPracticeByAthlete[r.athleteId] ?? null;
      const daysSincePractice = lastPracticeDate
        ? Math.floor((now.getTime() - new Date(lastPracticeDate).getTime()) / 86_400_000)
        : null;

      // Latest check-in
      const latestCheckIn = r.athlete.throwsCheckIns[0] ?? null;

      // Best recent mark
      const recentMark = bestMark14dByAthlete[r.athleteId] ?? null;

      // Testing status
      const testingRecords = r.testingRecords ?? [];
      const daysSinceTest =
        testingRecords.length > 0
          ? Math.floor((now.getTime() - new Date(testingRecords[0].testDate).getTime()) / 86_400_000)
          : null;
      const testStatus: "never" | "overdue" | "due-soon" | "ok" =
        testingRecords.length === 0
          ? "never"
          : daysSinceTest! > 14
          ? "overdue"
          : daysSinceTest! > 7
          ? "due-soon"
          : "ok";

      return {
        id: r.id,
        athleteId: r.athleteId,
        event: r.event,
        gender: r.gender,
        deficitPrimary: r.deficitPrimary,
        deficitStatus: r.deficitStatus,
        overPowered: r.overPowered,
        competitionPb: r.competitionPb,
        trainingPhase: (r as Record<string, unknown>).trainingPhase as string | null,
        athlete: {
          id: r.athlete.id,
          firstName: r.athlete.firstName,
          lastName: r.athlete.lastName,
          avatarUrl: r.athlete.avatarUrl,
          throwsPRs: r.athlete.throwsPRs,
        },
        testingRecords: r.testingRecords,
        testStatus,
        daysSinceTest,
        // Practice metrics
        throwsThisWeek,
        implementSplit: split,
        daysSincePractice,
        lastPracticeDate,
        // Wellness
        latestCheckIn,
        // Marks
        recentBestMark: recentMark,
      };
    });

    // Sort: overdue testing → never tested → due-soon → ok
    const statusOrder = { never: 0, overdue: 1, "due-soon": 2, ok: 3 };
    data.sort((a, b) => statusOrder[a.testStatus] - statusOrder[b.testStatus]);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error("Throws roster pulse error", { context: "dashboard/throws-roster-pulse", error });
    return NextResponse.json({ success: false, error: "Failed to fetch roster pulse" }, { status: 500 });
  }
}
