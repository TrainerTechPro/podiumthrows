import { NextRequest, NextResponse } from "next/server";
import { syncOuraData } from "@/lib/oura/sync";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

/**
 * GET /api/cron/oura-sync
 * Vercel Cron — runs every 15 minutes (offset by 7 min from WHOOP).
 * Syncs Oura Ring data for all connections that haven't synced in 15+ minutes.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ success: false, error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const staleConnections = await prisma.ouraConnection.findMany({
      where: {
        OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: fifteenMinutesAgo } }],
      },
      select: { id: true },
    });

    let synced = 0;
    let failed = 0;

    for (const connection of staleConnections) {
      try {
        await syncOuraData(connection.id);
        synced++;
      } catch (err) {
        failed++;
        logger.error("Oura cron sync failed for connection", {
          context: "cron",
          metadata: { connectionId: connection.id },
          error: err,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total: staleConnections.length,
        synced,
        failed,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error("Oura sync cron error", { context: "cron", error: err });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
