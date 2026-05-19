/**
 * PATCH /api/athlete/push-preferences
 *
 * Partial-merge update for an athlete's push notification preferences
 * (coachFeedback, teammatePRs, streakReminder, weeklyGoalReminder, practiceReminder).
 *
 * The preferences live inside AthleteProfile.notificationPreferences as
 * { pushPreferences: {...} } alongside feedPrivacy and streakReminder keys.
 * updatePushPreferences() handles the merge so other keys are preserved.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updatePushPreferences, type PushPreferences } from "@/lib/push/preferences";
import { logger } from "@/lib/logger";
import { parseBody, AthletePushPreferencesPatchSchema } from "@/lib/api-schemas";

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const parsed = await parseBody(req, AthletePushPreferencesPatchSchema);
    if (parsed instanceof NextResponse) return parsed;

    const updates: Partial<PushPreferences> = parsed;
    const updated = await updatePushPreferences(athlete.id, updates);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    logger.error("PATCH /api/athlete/push-preferences", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t save preferences." },
      { status: 500 }
    );
  }
}
