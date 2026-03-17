import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendWeeklyDigestEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/weekly-digest
 * Vercel Cron — runs every Sunday at 8 AM UTC.
 * Sends each coach a summary of their athletes' activity over the past 7 days.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoDate = weekAgo.toISOString().slice(0, 10); // YYYY-MM-DD for String date fields

    // Fetch all coaches who have at least one athlete, including athlete IDs
    const coaches = await prisma.coachProfile.findMany({
      where: { athletes: { some: {} } },
      select: {
        id: true,
        firstName: true,
        user: { select: { email: true } },
        athletes: { select: { id: true } },
        _count: { select: { athletes: true } },
      },
    });

    let emailsSent = 0;
    const errors: string[] = [];

    for (const coach of coaches) {
      try {
        const athleteIds = coach.athletes.map((a) => a.id);

        // Completed sessions this week
        const sessionsCompleted = await prisma.throwsAssignment.count({
          where: {
            athleteId: { in: athleteIds },
            completedAt: { gte: weekAgo },
          },
        });

        // New PRs this week (achievedAt is YYYY-MM-DD string)
        const newPRs = await prisma.throwsPR.findMany({
          where: {
            athleteId: { in: athleteIds },
            achievedAt: { gte: weekAgoDate },
          },
          include: { athlete: { select: { firstName: true, lastName: true } } },
          orderBy: { achievedAt: "desc" },
          take: 10,
        });

        // Low readiness check-ins (score <= 3 out of 10) this week
        const lowReadiness = await prisma.readinessCheckIn.findMany({
          where: {
            athleteId: { in: athleteIds },
            date: { gte: weekAgo },
            overallScore: { lte: 3 },
          },
          include: { athlete: { select: { firstName: true, lastName: true } } },
          orderBy: { overallScore: "asc" },
          take: 10,
        });

        // New athletes who joined this week
        const newAthletes = await prisma.athleteProfile.findMany({
          where: {
            coachId: coach.id,
            user: { createdAt: { gte: weekAgo } },
          },
          select: { firstName: true, lastName: true },
        });

        // Skip coaches with zero activity this week
        const hasActivity =
          sessionsCompleted > 0 ||
          newPRs.length > 0 ||
          lowReadiness.length > 0 ||
          newAthletes.length > 0;
        if (!hasActivity) continue;

        await sendWeeklyDigestEmail(coach.user.email, {
          coachName: coach.firstName,
          athleteCount: coach._count.athletes,
          sessionsCompleted,
          newPRs: newPRs.map((pr) => ({
            athleteName: `${pr.athlete.firstName} ${pr.athlete.lastName}`,
            event: pr.event,
            distance: pr.distance,
          })),
          lowReadiness: lowReadiness.map((r) => ({
            athleteName: `${r.athlete.firstName} ${r.athlete.lastName}`,
            score: r.overallScore,
          })),
          newAthletes: newAthletes.map((a) => `${a.firstName} ${a.lastName}`),
        });

        emailsSent++;
      } catch (err) {
        errors.push(
          `Coach ${coach.id}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    return NextResponse.json({
      ok: true,
      coachesProcessed: coaches.length,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    logger.error("Weekly digest cron error", { context: "api", error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
