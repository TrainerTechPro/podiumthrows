/**
 * Internal endpoint for sending push notifications with preference enforcement.
 *
 * Auth via CRON_SECRET header (for cron jobs) or x-internal-call header
 * (for server-side callers like server actions).
 *
 * Body:
 *   {
 *     userId?: string,           // direct user
 *     athleteId?: string,        // resolves to userId
 *     userIds?: string[],        // batch (cron-friendly)
 *     preferenceKey: string,     // one of pushPreferences keys; gates delivery
 *     payload: { title, body, url?, tag?, data? }
 *   }
 *
 * Returns: { sent: number, skipped: number, failed: number }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { getPushPreferencesByUserId } from "@/lib/push/preferences";
import { logger } from "@/lib/logger";
import { parseBody, PushSendSchema } from "@/lib/api-schemas";

export async function POST(req: NextRequest) {
  try {
    // Auth — accept either CRON_SECRET header or internal server call
    const authHeader = req.headers.get("authorization");
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isInternal = req.headers.get("x-internal-call") === process.env.INTERNAL_API_SECRET;

    if (!isCron && !isInternal) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBody(req, PushSendSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { userId, athleteId, userIds, preferenceKey, payload } = parsed;

    // Resolve target userIds
    let targetUserIds: string[] = [];
    if (userIds?.length) {
      targetUserIds = userIds;
    } else if (userId) {
      targetUserIds = [userId];
    } else if (athleteId) {
      const athlete = await prisma.athleteProfile.findUnique({
        where: { id: athleteId },
        select: { userId: true },
      });
      if (athlete) targetUserIds = [athlete.userId];
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ success: false, error: "no targets" }, { status: 400 });
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const targetId of targetUserIds) {
      try {
        // Check preference — skip if the user has opted out
        const prefs = await getPushPreferencesByUserId(targetId);
        if (!prefs[preferenceKey]) {
          skipped++;
          continue;
        }

        const deliveries = await sendPushToUser(targetId, {
          title: payload.title,
          body: payload.body,
          url: payload.url ?? undefined,
          tag: payload.tag ?? undefined,
          data: payload.data ?? undefined,
        });
        if (deliveries > 0) {
          sent++;
        } else {
          // No active subscriptions or all deliveries failed
          failed++;
        }
      } catch (err) {
        logger.error("push send error", {
          context: "push",
          userId: targetId,
          error: err,
        });
        failed++;
      }
    }

    return NextResponse.json({ success: true, data: { sent, skipped, failed } });
  } catch (err) {
    logger.error("/api/push/send error", { context: "push", error: err });
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
