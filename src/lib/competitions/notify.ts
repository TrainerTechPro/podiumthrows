import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";

export type PRCelebration = {
  event: string;
  oldPR: number;
  newPR: number;
};

export type NotifyInput = {
  athleteId: string;
  actorRole: "COACH" | "ATHLETE";
  meetName: string;
  competitionId: string;
  prCelebration: PRCelebration | null;
  isFirstThrow: boolean;
};

const EVENT_LABEL: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

/**
 * Fire-and-forget notification router for competition events.
 * NEVER throws — all errors are logged and swallowed so the caller's
 * mutation cannot be broken by a notification failure.
 */
export async function notifyCompetitionEvent(input: NotifyInput): Promise<void> {
  try {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: input.athleteId },
      select: { id: true, coachId: true, isSelfCoached: true },
    });
    if (!athlete) return;

    // Decide recipient. Athlete logged → notify coach (if linked). Coach logged → notify athlete.
    const targetCoachId =
      input.actorRole === "ATHLETE" && !athlete.isSelfCoached ? athlete.coachId : undefined;
    const targetAthleteId = input.actorRole === "COACH" ? athlete.id : undefined;

    // No recipient (e.g., self-coached athlete with no coach) — nothing to send for the PR case.
    if (!targetCoachId && !targetAthleteId) return;

    if (input.prCelebration) {
      const label = EVENT_LABEL[input.prCelebration.event] ?? input.prCelebration.event;
      await createNotification({
        type: "COMPETITION_PR",
        title: "New Competition PR",
        body: `${label} PR at ${input.meetName} — ${input.prCelebration.newPR.toFixed(2)}m (prev ${input.prCelebration.oldPR.toFixed(2)}m)`,
        coachId: targetCoachId,
        athleteProfileId: targetAthleteId,
        metadata: {
          competitionId: input.competitionId,
          event: input.prCelebration.event,
          oldPR: input.prCelebration.oldPR,
          newPR: input.prCelebration.newPR,
        },
      });
    } else if (input.isFirstThrow) {
      await createNotification({
        type: "COMPETITION_LOGGED",
        title: "Meet logged",
        body: `${input.meetName} — first throw entered`,
        coachId: targetCoachId,
        athleteProfileId: targetAthleteId,
        metadata: { competitionId: input.competitionId },
      });
    }
  } catch (err) {
    logger.error("notifyCompetitionEvent failed", { context: "competitions/notify", error: err });
  }
}
