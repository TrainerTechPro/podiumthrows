import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { buildWeeklyRecap, isAthleteActive } from "@/lib/recap/weekly";
import { getPushPreferences } from "@/lib/push/preferences";
import { sendAthleteWeeklyRecapEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { signUnsubscribeToken } from "@/lib/recap/unsubscribe-token";

const FIRST_WEEK_MIN_SESSIONS = 2;

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export type RecapJobResult = {
  evaluated: number;
  emailsSent: number;
  notificationsCreated: number;
  skippedInactive: number;
  skippedFirstWeek: number;
  skippedDuplicates: number;
  skippedAllChannelsOff: number;
  errors: number;
  durationMs: number;
};

/**
 * Sends each active athlete a weekly recap email + in-app notification
 * based on their last completed Mon→Sun block. Honors per-athlete
 * `weeklyRecapEmail` and `weeklyRecapInApp` push preferences. Idempotent:
 * if a WEEKLY_RECAP notification with the same `weekStart` already exists
 * for the athlete, the dispatch is skipped. Athletes with fewer than 2
 * logged sessions in the week are skipped — empty recaps demotivate.
 *
 * Per-tz dispatch (each athlete at 7pm local) is intentionally deferred —
 * the spec authorizes a single 7pm UTC tick for MVP.
 */
export async function runWeeklyRecapJob(): Promise<RecapJobResult> {
  const startedAt = Date.now();
  const baseUrl = appBaseUrl();

  const athletes = await prisma.athleteProfile.findMany({
    where: {
      user: { claimedAt: { not: null } },
    },
    select: {
      id: true,
      user: { select: { email: true } },
    },
  });

  let evaluated = 0;
  let emailsSent = 0;
  let notificationsCreated = 0;
  let skippedInactive = 0;
  let skippedFirstWeek = 0;
  let skippedDuplicates = 0;
  let skippedAllChannelsOff = 0;
  let errors = 0;

  for (const athlete of athletes) {
    evaluated++;
    try {
      const prefs = await getPushPreferences(athlete.id);
      if (!prefs.weeklyRecapEmail && !prefs.weeklyRecapInApp) {
        skippedAllChannelsOff++;
        continue;
      }

      const active = await isAthleteActive(athlete.id, 30);
      if (!active) {
        skippedInactive++;
        continue;
      }

      const recap = await buildWeeklyRecap(athlete.id);

      if (recap.sessionsLogged < FIRST_WEEK_MIN_SESSIONS) {
        skippedFirstWeek++;
        continue;
      }

      const alreadySent = await prisma.notification.findFirst({
        where: {
          athleteProfileId: athlete.id,
          type: "WEEKLY_RECAP",
          metadata: { path: ["weekStart"], equals: recap.weekStart },
        },
        select: { id: true },
      });
      if (alreadySent) {
        skippedDuplicates++;
        continue;
      }

      const profile = await prisma.athleteProfile.findUnique({
        where: { id: athlete.id },
        select: { firstName: true },
      });
      if (!profile) {
        skippedInactive++;
        continue;
      }

      const unsubToken = signUnsubscribeToken(athlete.id);
      const unsubscribeUrl = `${baseUrl}/api/recap/unsubscribe?aid=${athlete.id}&t=${unsubToken}`;
      const preferencesUrl = `${baseUrl}/athlete/settings/notifications`;

      if (prefs.weeklyRecapEmail && athlete.user?.email) {
        await sendAthleteWeeklyRecapEmail(athlete.user.email, {
          firstName: profile.firstName,
          weekStart: recap.weekStart,
          weekEnd: recap.weekEnd,
          sessionsLogged: recap.sessionsLogged,
          sessionsScheduled: recap.sessionsScheduled,
          throwsLogged: recap.throwsLogged,
          prs: recap.prs.map((p) => ({
            event: p.event,
            implement: p.implement,
            distance: p.distance,
          })),
          streakEnd: recap.streakEnd,
          streakDelta: recap.streakDelta,
          readinessAvg: recap.readinessAvg,
          shoutout: recap.shoutout,
          nextWeekSessionsCount: recap.nextWeekPreview.sessionsCount,
          unsubscribeUrl,
          preferencesUrl,
        });
        emailsSent++;
      }

      if (prefs.weeklyRecapInApp) {
        await createNotification({
          type: "WEEKLY_RECAP",
          athleteProfileId: athlete.id,
          title: "Your week in throws",
          body: recap.shoutout,
          metadata: {
            weekStart: recap.weekStart,
            weekEnd: recap.weekEnd,
            sessionsLogged: recap.sessionsLogged,
            throwsLogged: recap.throwsLogged,
            prs: recap.prs.length,
            url: `/athlete/dashboard?recap=${recap.weekStart}`,
          },
        });
        notificationsCreated++;
      }
    } catch (err) {
      errors++;
      logger.error("weekly-recap dispatch failed", {
        context: "cron/weekly-recap",
        metadata: { athleteId: athlete.id, error: String(err) },
      });
    }
  }

  return {
    evaluated,
    emailsSent,
    notificationsCreated,
    skippedInactive,
    skippedFirstWeek,
    skippedDuplicates,
    skippedAllChannelsOff,
    errors,
    durationMs: Date.now() - startedAt,
  };
}
