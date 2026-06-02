import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { getPushPreferences } from "@/lib/push/preferences";
import { logger } from "@/lib/logger";
import { assertCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/weekly-goal-reminder
 * Vercel Cron — runs every Sunday at 12:00 UTC (≈7 AM CT).
 *
 * Finds all athletes with at least one ACTIVE goal that has some progress
 * (currentValue > 0 and not yet complete), then sends a push nudge with
 * progress context for the most-progressed goal.
 *
 * Athletes with `weeklyGoalReminder` preference disabled are skipped.
 */
export async function GET(req: NextRequest) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  try {
    const now = new Date();

    // Find all athletes who have at least one ACTIVE goal with progress > 0
    const athletesWithGoals = await prisma.athleteProfile.findMany({
      where: {
        goals: {
          some: {
            status: "ACTIVE",
            currentValue: { gt: 0 },
          },
        },
      },
      select: {
        id: true,
        userId: true,
        firstName: true,
        goals: {
          where: {
            status: "ACTIVE",
            currentValue: { gt: 0 },
          },
          select: {
            id: true,
            title: true,
            currentValue: true,
            targetValue: true,
            unit: true,
          },
          orderBy: { currentValue: "desc" },
          take: 1,
        },
      },
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const athlete of athletesWithGoals) {
      const topGoal = athlete.goals[0];
      if (!topGoal) {
        skipped++;
        continue;
      }

      const prefs = await getPushPreferences(athlete.id);
      if (!prefs.weeklyGoalReminder) {
        skipped++;
        continue;
      }

      const isComplete = topGoal.currentValue >= topGoal.targetValue;
      const remaining = Math.max(0, topGoal.targetValue - topGoal.currentValue);

      let body: string;
      if (isComplete) {
        body = `Goal complete! ${topGoal.currentValue}/${topGoal.targetValue} ${topGoal.unit} 🎯`;
      } else {
        body = `${topGoal.currentValue}/${topGoal.targetValue} ${topGoal.unit} — ${remaining} ${topGoal.unit} to hit your goal`;
      }

      try {
        const delivered = await sendPushToUser(athlete.userId, {
          title: "📊 How's your week going?",
          body,
          url: "/athlete/dashboard",
          tag: `weekly-goal-${athlete.id}`,
          data: {
            type: "weekly_goal_reminder",
            athleteId: athlete.id,
            goalId: topGoal.id,
          },
        });
        if (delivered > 0) {
          sent++;
        } else {
          skipped++;
        }
      } catch (err) {
        failed++;
        logger.error("weekly-goal-reminder: push failed", {
          context: "cron",
          metadata: { athleteId: athlete.id, goalId: topGoal.id },
          error: err,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        scanned: athletesWithGoals.length,
        sent,
        skipped,
        failed,
        timestamp: now.toISOString(),
      },
    });
  } catch (err) {
    logger.error("weekly-goal-reminder cron error", { context: "cron", error: err });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
