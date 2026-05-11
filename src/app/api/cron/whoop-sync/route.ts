import { NextRequest, NextResponse } from "next/server";
import { syncWhoopData } from "@/lib/whoop/sync";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

/**
 * GET /api/cron/whoop-sync
 * Vercel Cron — runs every 15 minutes.
 * Syncs WHOOP data for all connections that haven't synced in 15+ minutes.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const staleConnections = await prisma.whoopConnection.findMany({
      where: {
        OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: fifteenMinutesAgo } }],
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
        const message = err instanceof Error ? err.message : "Unknown error";
        // Persist the failure so the connection's UI can surface "sync failed
        // 14m ago" without re-querying Sentry.
        await prisma.whoopConnection
          .update({
            where: { id: connection.id },
            data: { lastSyncError: message, lastSyncErrorAt: new Date() },
          })
          .catch(() => null);

        // Auth-expired errors are user-actionable, not platform bugs — the
        // user must reauth in Settings. Without this downgrade the cron
        // escalates a Sentry issue every 15 min for as long as the connection
        // is broken (PODIUM-THROWS-15: 100 events from one connection in 25h).
        const isAuthExpired = message.includes("WHOOP authorization has expired");
        const log = isAuthExpired ? logger.warn : logger.error;
        log("WHOOP cron sync failed for connection", {
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
    logger.error("WHOOP sync cron error", { context: "cron", error: err });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
