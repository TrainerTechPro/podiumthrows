import { NextRequest, NextResponse } from "next/server";
import { cleanupExpired } from "@/lib/token-blacklist";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/cleanup-blacklist
 * Vercel Cron — runs daily at midnight UTC.
 * Deletes expired entries from the TokenBlacklist table.
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
    const deleted = await cleanupExpired();
    return NextResponse.json({ ok: true, deleted, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error("Token blacklist cleanup cron error", { context: "api", error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
