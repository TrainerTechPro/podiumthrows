/**
 * Weekly Goal Transitions Cron
 *
 * Runs daily at 01:00 UTC. Finds every ACTIVE Goal with unit "throws"
 * and a deadline that has already passed, counts the athlete's throws
 * between the goal's createdAt and its deadline, and transitions the
 * goal to COMPLETED (target reached) or MISSED (deadline passed without
 * hitting target).
 *
 * Authenticated via `Authorization: Bearer ${CRON_SECRET}` matching the
 * pattern used by the other crons in this project (see cleanup-blacklist,
 * recurring-forms, weekly-digest).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { emitGoalCompleted } from "@/lib/team-activity";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Pull all expired active throws-goals in one query
    const expiredGoals = await prisma.goal.findMany({
      where: {
        status: "ACTIVE",
        unit: "throws",
        deadline: { not: null, lt: now },
      },
      select: {
        id: true,
        athleteId: true,
        title: true,
        targetValue: true,
        unit: true,
        createdAt: true,
        deadline: true,
      },
    });

    let completed = 0;
    let missed = 0;

    for (const goal of expiredGoals) {
      // Count throws logged between the goal's start and its deadline.
      // Using createdAt as the window start mirrors the widget's "live
      // count" behavior — if the athlete sets a goal mid-week, only
      // throws after that moment count.
      const throwCount = await prisma.throwLog.count({
        where: {
          athleteId: goal.athleteId,
          date: {
            gte: goal.createdAt,
            lt: goal.deadline as Date,
          },
        },
      });

      const hit = throwCount >= goal.targetValue;

      await prisma.goal.update({
        where: { id: goal.id },
        data: {
          status: hit ? "COMPLETED" : "MISSED",
          currentValue: throwCount,
        },
      });

      if (hit) {
        completed += 1;
        // Fire team feed GOAL_COMPLETED event. Fire-and-forget in
        // sequence (inside the for loop) is fine because the cron is
        // not latency-sensitive — we're running it at 01:00 UTC and
        // scanning at most a few dozen goals per run.
        void emitGoalCompleted(goal.athleteId, {
          goalId: goal.id,
          title: goal.title,
          targetValue: goal.targetValue,
          unit: goal.unit,
        }).catch(() => null);
      } else {
        missed += 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        scanned: expiredGoals.length,
        completed,
        missed,
        timestamp: now.toISOString(),
      },
    });
  } catch (err) {
    logger.error("Weekly goal transitions cron error", {
      context: "api",
      error: err,
    });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
