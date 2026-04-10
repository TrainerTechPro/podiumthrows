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

    // Accept any subset of PushPreferences keys; ignore unknown keys.
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const VALID_KEYS: Array<keyof PushPreferences> = [
      "coachFeedback",
      "teammatePRs",
      "streakReminder",
      "weeklyGoalReminder",
      "practiceReminder",
    ];
    const updates: Partial<PushPreferences> = {};
    for (const key of VALID_KEYS) {
      if (typeof body[key] === "boolean") {
        (updates as Record<string, boolean>)[key] = body[key] as boolean;
      }
    }

    const updated = await updatePushPreferences(athlete.id, updates);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    logger.error("PATCH /api/athlete/push-preferences", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to save preferences." }, { status: 500 });
  }
}
