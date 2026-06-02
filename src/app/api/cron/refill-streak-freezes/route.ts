/**
 * GET /api/cron/refill-streak-freezes
 *
 * Vercel Cron — runs daily at 05:00 UTC. Refills the weekly freeze quota
 * (to 1) for athletes whose local-Sunday rolled over since their last refill.
 *
 * Daily-vs-weekly: we run every day so we can hit "local Sunday" for athletes
 * in any timezone. The engine's `refillWeeklyFreezes` is the gate — it only
 * applies when (a) it's locally Sunday and (b) we haven't already refilled
 * for that local Sunday.
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { refillWeeklyFreezes } from "@/lib/athlete/streak-engine";
import { assertCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  try {
    const result = await refillWeeklyFreezes();
    return NextResponse.json({
      success: true,
      data: {
        refilled: result.refilled,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error("refill-streak-freezes cron error", { context: "cron", error: err });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
