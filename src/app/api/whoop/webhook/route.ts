import { NextRequest, NextResponse } from "next/server";
import { syncWhoopData } from "@/lib/whoop/sync";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * POST /api/whoop/webhook
 * Receives webhook events from WHOOP when new data is available.
 * This is a public route — CSRF is skipped in middleware.
 * Always returns 200 to prevent WHOOP from retrying.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // WHOOP webhook payload includes user_id (integer) and type
    const whoopUserId = body?.user_id as number | undefined;
    if (!whoopUserId) {
      logger.warn("WHOOP webhook: missing user_id", {
        context: "api",
        metadata: { body },
      });
      return NextResponse.json({ ok: true });
    }

    // Look up connection by WHOOP user ID
    const connection = await prisma.whoopConnection.findFirst({
      where: { whoopUserId },
      select: { id: true },
    });

    if (!connection) {
      // User may have disconnected — acknowledge silently
      return NextResponse.json({ ok: true });
    }

    await syncWhoopData(connection.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("POST /api/whoop/webhook", { context: "api", error: err });
    // Always return 200 so WHOOP doesn't retry
    return NextResponse.json({ ok: true });
  }
}
