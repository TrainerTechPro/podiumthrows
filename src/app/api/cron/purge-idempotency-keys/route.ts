import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { assertCronAuth } from "@/lib/cron-auth";

export const maxDuration = 60;

const RETENTION_HOURS = 24;

/**
 * GET /api/cron/purge-idempotency-keys
 * Vercel Cron — daily at 03:00 UTC.
 *
 * Deletes IdempotencyKey rows older than 24h. The retention window is
 * intentionally short: clients only retry within seconds of the original
 * request (offline outbox replay on reconnect, or human-driven refresh).
 * After 24h, the cache row is dead weight and the table grows unbounded
 * if not purged.
 *
 * If a client retries with an expired key, the wrapper falls through and
 * runs the handler — the only consequence is a possible duplicate write
 * for that one stale request, which is the same risk as no idempotency.
 */
export async function GET(req: NextRequest) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000);

  try {
    const result = await prisma.idempotencyKey.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return NextResponse.json({
      success: true,
      data: {
        deleted: result.count,
        cutoff: cutoff.toISOString(),
      },
    });
  } catch (err) {
    logger.error("purge-idempotency-keys cron failed", { context: "cron", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t purge idempotency keys" },
      { status: 500 }
    );
  }
}
