import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");

    if (!athleteId) {
      return NextResponse.json({ success: false, error: "athleteId is required" }, { status: 400 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Fetch all profile data in parallel
    const [athlete, typing, checkins, complexes, competitions, prs, drillPRs, throwLogs] = await Promise.all([
      prisma.athleteProfile.findUnique({
        where: { id: athleteId },
        select: {
          id: true,
          gender: true,
          weightKg: true,
          heightCm: true,
          firstName: true,
          lastName: true,
          user: { select: { id: true, email: true } },
        },
      }),
      prisma.throwsTyping.findUnique({ where: { athleteId } }),
      prisma.throwsCheckIn.findMany({
        where: { athleteId },
        orderBy: { date: "desc" },
        take: 90,
      }),
      prisma.throwsComplex.findMany({
        where: { athleteId },
        orderBy: { startDate: "desc" },
      }),
      prisma.throwsCompetition.findMany({
        where: { athleteId },
        orderBy: { date: "asc" },
      }),
      prisma.throwsPR.findMany({
        where: { athleteId },
        orderBy: { distance: "desc" },
      }),
      prisma.throwsDrillPR.findMany({
        where: { athleteId },
        orderBy: [{ event: "asc" }, { drillType: "asc" }, { distance: "desc" }],
      }),
      prisma.throwsBlockLog.findMany({
        where: {
          assignment: { athleteId },
        },
        include: {
          assignment: {
            select: { assignedDate: true, status: true },
          },
          block: {
            select: { config: true, blockType: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);

    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    // Training marks: every throw log with a recorded distance
    const trainingMarks = throwLogs
      .filter((l) => l.distance != null)
      .map((l) => ({
        date: l.assignment.assignedDate,
        distance: l.distance!,
        implement: l.implement,
        throwNumber: l.throwNumber,
        source: "training" as const,
      }));

    // Actual competition results (from ThrowsCompetition.result)
    const competitionResultMarks = competitions
      .filter((c) => c.result != null)
      .map((c) => ({
        date: c.date,
        distance: c.result!,
        implement: "competition",
        throwNumber: 1,
        source: "competition" as const,
        competitionName: c.name,
        priority: c.priority,
      }));

    // Merge and sort chronologically — competition results take precedence visually
    const competitionMarks = [...trainingMarks, ...competitionResultMarks]
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get assignment stats
    const assignments = await prisma.throwsAssignment.findMany({
      where: { athleteId },
      select: { id: true, assignedDate: true, status: true, selfFeeling: true, rpe: true },
      orderBy: { assignedDate: "desc" },
      take: 100,
    });

    // Calculate annual volume from throw logs
    const currentYear = new Date().getFullYear().toString();
    const yearLogs = throwLogs.filter((l) => l.assignment.assignedDate.startsWith(currentYear));
    const annualThrowCount = yearLogs.filter((l) => l.distance != null).length;

    const benchmarks: Record<string, number | null> = {};

    return NextResponse.json({
      success: true,
      data: {
        athlete: {
          id: athlete.id,
          email: athlete.user.email,
          
          gender: athlete.gender,
          sport: null,
          weight: athlete.weightKg,
          height: athlete.heightCm,
        },
        typing,
        checkins,
        complexes,
        competitions,
        prs,
        drillPRs,
        benchmarks,
        assignments,
        competitionMarks,
        annualThrowCount,
      },
    });
  } catch (error) {
    logger.error("Get profile error", { context: "throws/profile", error: error });
    return NextResponse.json({ success: false, error: "Failed to fetch profile" }, { status: 500 });
  }
}
