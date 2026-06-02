import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { notifyAthleteCompetitionReminder } from "@/lib/notifications";
import { assertCronAuth } from "@/lib/cron-auth";

export const maxDuration = 60;

/**
 * GET /api/cron/competition-reminders
 * Vercel Cron — runs daily at 13:00 UTC (mid-morning US Eastern, covers
 * most athletes' mornings globally).
 *
 * Fires COMPETITION_REMINDER notifications for two thresholds:
 *   - 7 days before competition (planning horizon)
 *   - 1 day before competition (tomorrow reminder)
 *
 * Idempotency is intrinsic: each threshold corresponds to exactly one
 * calendar day relative to the competition date, and the cron fires once
 * per UTC day. Re-running the cron in the same day re-emits the
 * notification, but Vercel cron runs once per schedule firing so this
 * doesn't happen in practice.
 *
 * Timezone note: ThrowsCompetition.date is stored as YYYY-MM-DD without
 * timezone context. We treat today as UTC for the reminder comparison.
 * An athlete whose competition is 2026-04-16 will see the "tomorrow"
 * reminder on 2026-04-15 UTC — late evening 4/15 or early morning 4/16
 * in their local tz. Close enough for "tomorrow" semantics.
 */
function formatYMD(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  try {
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneDayOut = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    const sevenDaysOutStr = formatYMD(sevenDaysOut);
    const oneDayOutStr = formatYMD(oneDayOut);

    // Only future competitions with no result yet. Past competitions with
    // results shouldn't get reminders even if date math aligns (shouldn't
    // happen, but defensive).
    const upcoming = await prisma.throwsCompetition.findMany({
      where: {
        OR: [{ date: sevenDaysOutStr }, { date: oneDayOutStr }],
        result: null,
      },
      select: {
        id: true,
        athleteId: true,
        name: true,
        event: true,
        date: true,
      },
    });

    if (upcoming.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          sevenDayOut: 0,
          oneDayOut: 0,
          notified: 0,
          timestamp: now.toISOString(),
        },
      });
    }

    const settled = await Promise.allSettled(
      upcoming.map((c) => {
        const threshold: "7_DAYS" | "1_DAY" = c.date === sevenDaysOutStr ? "7_DAYS" : "1_DAY";
        return notifyAthleteCompetitionReminder(
          c.athleteId,
          c.id,
          c.name,
          c.event as string,
          c.date,
          threshold
        );
      })
    );

    const notified = settled.filter((s) => s.status === "fulfilled").length;
    const failed = settled.length - notified;
    if (failed > 0) {
      logger.error("competition-reminders: some notifications failed", {
        context: "cron",
        metadata: { failures: failed, total: settled.length },
      });
    }

    const sevenDayCount = upcoming.filter((c) => c.date === sevenDaysOutStr).length;
    const oneDayCount = upcoming.filter((c) => c.date === oneDayOutStr).length;

    return NextResponse.json({
      success: true,
      data: {
        sevenDayOut: sevenDayCount,
        oneDayOut: oneDayCount,
        notified,
        failed,
        timestamp: now.toISOString(),
      },
    });
  } catch (err) {
    logger.error("competition-reminders cron error", { context: "cron", error: err });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
