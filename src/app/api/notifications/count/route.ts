import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getUnreadCount, resolveNotificationContext } from "@/lib/notifications";

/* ─── GET — lightweight unread count for badge polling ───────────────────── */

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const ctx = await resolveNotificationContext(session);
    if (!ctx) {
      return NextResponse.json({ success: true, data: { count: 0 } });
    }

    const count = await getUnreadCount(ctx.profileId, ctx.effectiveRole);
    return NextResponse.json({ success: true, data: { count } });
  } catch (err) {
    // Previously returned 200/count=0 which hid outages from monitoring.
    // Return a proper 500 + logged error so the polling client can show a
    // stale badge rather than pretending zero unread.
    logger.error("GET /api/notifications/count", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t fetch unread count." },
      { status: 500 }
    );
  }
}
