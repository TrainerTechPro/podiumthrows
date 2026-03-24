import { NextRequest, NextResponse } from "next/server";
import { syncOuraData } from "@/lib/oura/sync";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/oura-sync
 * Vercel Cron — runs daily at 8:30 AM UTC.
 * Syncs Oura Ring data for all connections that haven't synced in 20+ hours.
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

    const staleConnections = await prisma.ouraConnection.findMany({
      where: {
        OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: twentyHoursAgo } }],
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
      ok: true,
      total: staleConnections.length,
      synced,
      failed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Oura sync cron error", { context: "cron", error: err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
