import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { markAllAsRead, resolveNotificationContext } from "@/lib/notifications";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const ctx = await resolveNotificationContext(session);
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
    }

    await markAllAsRead(ctx.profileId, ctx.effectiveRole);
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (err) {
    logger.error("POST /api/notifications/mark-all-read", {
      context: "api",
      metadata: { error: String(err) },
    });
    return NextResponse.json(
      { success: false, error: "Failed to mark notifications as read." },
      { status: 500 }
    );
  }
}
