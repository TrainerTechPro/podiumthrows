import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { getPushPreferences } from "@/lib/push/preferences";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/practice-reminder
 * Vercel Cron — runs every 5 minutes.
 *
 * Finds practices whose start time falls in the 25–35 minute window from now
 * and sends a push notification to each eligible athlete who has the
 * `practiceReminder` preference enabled.
 *
 * Uses the `tag` field so a repeat cron run in the same window replaces the
 * prior notification rather than stacking a duplicate.
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

    // Build the date strings we need to check — the 25–35 min window could
    // span a day boundary (e.g. 23:50 → 00:15 next day).
    const todayStr = now.toISOString().split("T")[0];
    const tomorrowMs = now.getTime() + 24 * 60 * 60 * 1000;
    const tomorrowStr = new Date(tomorrowMs).toISOString().split("T")[0];

    const practices = await prisma.scheduledPractice.findMany({
      where: {
        status: "SCHEDULED",
        date: { in: [todayStr, tomorrowStr] },
      },
      select: {
        id: true,
        coachId: true,
        title: true,
        date: true,
        startTime: true,
        location: true,
        groupId: true,
      },
    });

    let scanned = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const practice of practices) {
      // Compute the absolute UTC start time from date (YYYY-MM-DD) + startTime (HH:MM)
      const [year, month, day] = practice.date.split("-").map(Number);
      const [hours, minutes] = practice.startTime.split(":").map(Number);
      const startMs = Date.UTC(year, month - 1, day, hours, minutes);
      const minutesUntil = Math.round((startMs - now.getTime()) / 60_000);

      // Only act on practices in the 25–35 minute window
      if (minutesUntil < 25 || minutesUntil > 35) continue;

      scanned++;

      // Resolve eligible athletes for this practice
      type EligibleAthlete = { id: string; userId: string; firstName: string };
      let eligibleAthletes: EligibleAthlete[];

      if (practice.groupId) {
        const members = await prisma.eventGroupMember.findMany({
          where: { groupId: practice.groupId },
          select: {
            athlete: {
              select: { id: true, userId: true, firstName: true, coachId: true },
            },
          },
        });
        // Filter to only athletes who belong to this coach (safety check)
        eligibleAthletes = members
          .filter((m) => m.athlete.coachId === practice.coachId)
          .map((m) => ({
            id: m.athlete.id,
            userId: m.athlete.userId,
            firstName: m.athlete.firstName,
          }));
      } else {
        // No group — target all athletes on the coach's roster
        eligibleAthletes = await prisma.athleteProfile.findMany({
          where: { coachId: practice.coachId },
          select: { id: true, userId: true, firstName: true },
        });
      }

      const title = "Practice in 30 minutes";
      const body = practice.location
        ? `${practice.title} — ${practice.location}`
        : practice.title;

      for (const athlete of eligibleAthletes) {
        try {
          const prefs = await getPushPreferences(athlete.id);
          if (!prefs.practiceReminder) {
            skipped++;
            continue;
          }

          const delivered = await sendPushToUser(athlete.userId, {
            title,
            body,
            url: "/athlete/dashboard",
            tag: `practice-${practice.id}`,
            data: { type: "practice_reminder", practiceId: practice.id },
          });

          if (delivered > 0) {
            sent++;
          } else {
            // No active subscriptions — not a failure, just not deliverable
            skipped++;
          }
        } catch (err) {
          failed++;
          logger.error("practice-reminder: push failed", {
            context: "cron",
            metadata: { practiceId: practice.id, athleteId: athlete.id },
            error: err,
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      scanned,
      sent,
      skipped,
      failed,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    logger.error("practice-reminder cron error", { context: "cron", error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
