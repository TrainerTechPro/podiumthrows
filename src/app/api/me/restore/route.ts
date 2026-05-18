/**
 * POST /api/me/restore
 *
 * Cancels a pending account deletion if the user is still within the
 * 30-day grace window. Requires an authenticated session — the user
 * proves they own the account by logging in (auth flow accepts logins
 * during grace; the UI prompts for restore after login when deletedAt
 * is set on the user row).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { restoreUser } from "@/lib/account-delete/helpers";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let restored: boolean;
  try {
    restored = await restoreUser(session.userId);
  } catch (err) {
    logger.error("restore failed", {
      context: "api/me/restore",
      metadata: { userId: session.userId },
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to restore account" },
      { status: 500 }
    );
  }

  if (!restored) {
    return NextResponse.json(
      {
        success: false,
        error: "This account isn't pending deletion, or the grace window has passed.",
      },
      { status: 409 }
    );
  }

  void logAudit({
    userId: session.userId,
    action: "ACCOUNT_RESTORED",
    metadata: { role: session.role },
    ...auditRequestInfo(request),
  });

  return NextResponse.json({ success: true, data: { restored: true } });
}
