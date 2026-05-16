/**
 * DELETE /api/me
 *
 * Soft-deletes the current user with a 30-day grace window. The hard-delete
 * cron sweeps rows past their grace. The current JWT is blacklisted and
 * both cookies are cleared so the user is fully logged out — they can log
 * back in within the grace window and hit POST /api/me/restore to revive.
 *
 * Coach edge case: refused if the coach has any athletes. The
 * AthleteProfile.coachId FK is currently `onDelete: Cascade`, so a coach
 * hard-delete would obliterate athlete data. Until that schema rule is
 * relaxed (follow-up: nullable coachId + SetNull), the safe answer is
 * "remove the roster first."
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, clearAuthCookie, clearCsrfCookie } from "@/lib/auth";
import { blacklistToken } from "@/lib/token-blacklist";
import { canDeleteAccount, softDeleteUser } from "@/lib/account-delete/helpers";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const eligibility = await canDeleteAccount(session.userId);
  if (!eligibility.canDelete) {
    return NextResponse.json(
      {
        success: false,
        error: eligibility.reason || "Cannot delete account",
      },
      { status: 409 }
    );
  }

  let result;
  try {
    result = await softDeleteUser(session.userId);
  } catch (err) {
    logger.error("soft-delete failed", {
      context: "api/me/DELETE",
      metadata: { userId: session.userId },
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to delete account" },
      { status: 500 }
    );
  }

  // Force-logout: blacklist current token + clear both cookies.
  const cookieStore = await cookies();
  const rawToken = cookieStore.get("auth-token")?.value;
  if (rawToken) {
    try {
      await blacklistToken(rawToken);
    } catch (err) {
      logger.error("blacklist on account delete failed", {
        context: "api/me/DELETE",
        metadata: { userId: session.userId },
        error: err,
      });
      // Continue — soft-delete already wrote, cookies are cleared below.
    }
  }

  void logAudit({
    userId: session.userId,
    action: "ACCOUNT_SOFT_DELETED",
    metadata: {
      role: session.role,
      deleteScheduledFor: result.deleteScheduledFor.toISOString(),
    },
    ...auditRequestInfo(request),
  });

  const response = NextResponse.json({
    success: true,
    data: {
      deletedAt: result.deletedAt.toISOString(),
      deleteScheduledFor: result.deleteScheduledFor.toISOString(),
    },
  });
  response.headers.append("Set-Cookie", clearAuthCookie());
  response.headers.append("Set-Cookie", clearCsrfCookie());
  return response;
}
