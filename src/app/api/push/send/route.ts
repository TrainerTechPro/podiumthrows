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
import {
  getPushPreferencesByUserId,
  type PushPreferenceKey,
} from "@/lib/push/preferences";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Auth — accept either CRON_SECRET header or internal server call
    const authHeader = req.headers.get("authorization");
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isInternal =
      req.headers.get("x-internal-call") === process.env.INTERNAL_API_SECRET;

    if (!isCron && !isInternal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      userId?: string;
      athleteId?: string;
      userIds?: string[];
      preferenceKey?: PushPreferenceKey;
      payload?: {
        title: string;
        body: string;
        url?: string;
        tag?: string;
        data?: Record<string, unknown>;
      };
    };

    if (!body.payload || !body.payload.title || !body.payload.body) {
      return NextResponse.json(
        { error: "payload.title and payload.body required" },
        { status: 400 }
      );
    }
    if (!body.preferenceKey) {
      return NextResponse.json(
        { error: "preferenceKey required" },
        { status: 400 }
      );
    }

    // Resolve target userIds
    let targetUserIds: string[] = [];
    if (body.userIds?.length) {
      targetUserIds = body.userIds;
    } else if (body.userId) {
      targetUserIds = [body.userId];
    } else if (body.athleteId) {
      const athlete = await prisma.athleteProfile.findUnique({
        where: { id: body.athleteId },
        select: { userId: true },
      });
      if (athlete) targetUserIds = [athlete.userId];
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: "no targets" }, { status: 400 });
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const userId of targetUserIds) {
      try {
        // Check preference — skip if the user has opted out
        const prefs = await getPushPreferencesByUserId(userId);
        if (!prefs[body.preferenceKey]) {
          skipped++;
          continue;
        }

        const deliveries = await sendPushToUser(userId, body.payload);
        if (deliveries > 0) {
          sent++;
        } else {
          // No active subscriptions or all deliveries failed
          failed++;
        }
      } catch (err) {
        logger.error("push send error", {
          context: "push",
          userId,
          error: err,
        });
        failed++;
      }
    }

    return NextResponse.json({ sent, skipped, failed });
  } catch (err) {
    logger.error("/api/push/send error", { context: "push", error: err });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
