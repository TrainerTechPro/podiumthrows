import { NextRequest, NextResponse } from "next/server";
import { syncWhoopData } from "@/lib/whoop/sync";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/whoop-sync
 * Vercel Cron — runs daily at 8:00 AM UTC.
 * Syncs WHOOP data for all connections that haven't synced in 20+ hours.
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
    const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);

    const staleConnections = await prisma.whoopConnection.findMany({
      where: {
        OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: twentyHoursAgo } }],
      },
      select: { id: true },
    });

    let synced = 0;
    let failed = 0;

    for (const connection of staleConnections) {
      try {
        await syncWhoopData(connection.id);
        synced++;
      } catch (err) {
        failed++;
        logger.error("WHOOP cron sync failed for connection", {
          context: "cron",
          metadata: { connectionId: connection.id },
          error: err,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      total: staleConnections.length,
      synced,
      failed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("WHOOP sync cron error", { context: "cron", error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
