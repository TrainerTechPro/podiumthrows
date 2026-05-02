/**
 * GET /api/cron/hard-delete-users
 * Vercel Cron — daily at 04:00 UTC.
 *
 * Hard-deletes User rows whose 30-day soft-delete grace window has
 * passed. Cascade rules in the schema clean up dependent rows
 * (CoachProfile, AthleteProfile, BetaFeedback, PushSubscription, etc.).
 * Each successful delete is logged to AuditLog with the userId — that
 * row survives the user delete because AuditLog.userId is a plain
 * String? without an FK constraint.
 */

import { NextRequest, NextResponse } from "next/server";
import { hardDeleteEligibleUsers } from "@/lib/account-delete/helpers";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startedAt = Date.now();
    const { deletedIds } = await hardDeleteEligibleUsers();

    for (const userId of deletedIds) {
      void logAudit({
        userId,
        action: "ACCOUNT_HARD_DELETED",
        metadata: { reason: "grace_window_expired" },
      });
    }

    logger.info("hard-delete cron complete", {
      context: "cron/hard-delete-users",
      metadata: {
        deletedCount: deletedIds.length,
        durationMs: Date.now() - startedAt,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        deleted: deletedIds.length,
      },
    });
  } catch (err) {
    logger.error("hard-delete cron failed", {
      context: "cron/hard-delete-users",
      error: err,
    });
    return NextResponse.json({ success: false, error: "Hard-delete cron failed" }, { status: 500 });
  }
}
