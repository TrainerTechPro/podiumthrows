import { NextRequest, NextResponse } from "next/server";
import { cleanupExpired } from "@/lib/token-blacklist";
import { logger } from "@/lib/logger";
import { assertCronAuth } from "@/lib/cron-auth";

export const maxDuration = 60;

/**
 * GET /api/cron/cleanup-blacklist
 * Vercel Cron — runs daily at midnight UTC.
 * Deletes expired entries from the TokenBlacklist table.
 */
export async function GET(req: NextRequest) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  try {
    const deleted = await cleanupExpired();
    return NextResponse.json({
      success: true,
      data: { deleted, timestamp: new Date().toISOString() },
    });
  } catch (err) {
    logger.error("Token blacklist cleanup cron error", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
