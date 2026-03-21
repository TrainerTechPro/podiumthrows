import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { shouldRunToday, calculateNextRunDate } from "@/lib/forms/recurring-scheduler";
import type { RecurrenceFrequency } from "@/lib/forms/types";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/recurring-forms
 * Vercel Cron — runs daily at 6 AM UTC.
 * Creates assignments for all active recurring schedules that are due today.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sets this header for cron jobs)
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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Find all active schedules
    const schedules = await prisma.recurringSchedule.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      include: {
        questionnaire: {
          select: {
            id: true,
            status: true,
            coachId: true,
          },
        },
      },
    });

    let totalCreated = 0;
    const errors: string[] = [];

    for (const schedule of schedules) {
      try {
        // Skip if questionnaire not published
        if (schedule.questionnaire.status !== "published") continue;

        // Check if should run today
        const shouldRun = shouldRunToday({
          frequency: schedule.frequency as RecurrenceFrequency,
          specificDays: schedule.specificDays,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          lastRunAt: schedule.lastRunAt,
        });

        if (!shouldRun) continue;

        // Resolve athlete IDs
        let athleteIds: string[] = [];

        if (schedule.assignToAll) {
          // Get all athletes under this coach
          const athletes = await prisma.athleteProfile.findMany({
            where: { coachId: schedule.questionnaire.coachId },
            select: { id: true },
          });
          athleteIds = athletes.map((a) => a.id);
        } else {
          athleteIds = [...schedule.athleteIds];

          // Resolve event group IDs if any (athletes relate to groups via EventGroupMember)
          if (schedule.groupIds.length > 0) {
            const groupMembers = await prisma.eventGroupMember.findMany({
              where: { groupId: { in: schedule.groupIds } },
              select: { athleteId: true },
            });
            const teamAthleteIds = groupMembers.map((m) => m.athleteId);
            const combined = new Set([...athleteIds, ...teamAthleteIds]);
            athleteIds = Array.from(combined);
          }
        }

        if (athleteIds.length === 0) continue;

        // Create assignments for each athlete (skip if already exists for today)
        const instanceDate = today;

        const existingAssignments = await prisma.questionnaireAssignment.findMany({
          where: {
            questionnaireId: schedule.questionnaireId,
            instanceDate,
          },
          select: { athleteId: true },
        });

        const existingAthleteIds = new Set(existingAssignments.map((a) => a.athleteId));
        const newAthleteIds = athleteIds.filter((id) => !existingAthleteIds.has(id));

        if (newAthleteIds.length > 0) {
          await prisma.questionnaireAssignment.createMany({
            data: newAthleteIds.map((athleteId) => ({
              questionnaireId: schedule.questionnaireId,
              athleteId,
              source: "RECURRING" as const,
              scheduleId: schedule.id,
              instanceDate,
              dueDate: instanceDate, // Due same day
            })),
          });

          totalCreated += newAthleteIds.length;
        }

        // Update schedule lastRunAt and nextRunAt
        const nextRunAt = calculateNextRunDate({
          frequency: schedule.frequency as RecurrenceFrequency,
          specificDays: schedule.specificDays,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          lastRunAt: now,
        });

        await prisma.recurringSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: now,
            nextRunAt,
          },
        });
      } catch (err) {
        errors.push(
          `Schedule ${schedule.id}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    return NextResponse.json({
      ok: true,
      schedulesChecked: schedules.length,
      assignmentsCreated: totalCreated,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    logger.error("Recurring forms cron error", { context: "api", error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
