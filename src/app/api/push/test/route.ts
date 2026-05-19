/**
 * POST /api/push/test
 *
 * Sends a "Test notification — Podium is connected." push to every active
 * subscription belonging to the calling user. Used by the settings page
 * "Send me a test notification" button so a user can verify the full
 * SW → server → push service → device path on their own device.
 *
 * Bypasses the per-type preference gate on purpose: a test is an explicit
 * user action and shouldn't be silenced by their own toggles.
 *
 * Returns:
 *   { success: true, data: { delivered: number } }
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendPushToUser, getVapidPublicKey } from "@/lib/push";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!getVapidPublicKey()) {
      return NextResponse.json(
        {
          success: false,
          error: "Push notifications are not configured on this server.",
        },
        { status: 501 }
      );
    }

    const delivered = await sendPushToUser(session.userId, {
      title: "Test notification",
      body: "Podium is connected. You'll get pings like this when something matters.",
      url: "/",
      tag: "podium-test",
      data: { type: "test" },
    });

    if (delivered === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No active subscriptions for this account. Enable push above, then try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, data: { delivered } });
  } catch (err) {
    logger.error("POST /api/push/test", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t send test notification." },
      { status: 500 }
    );
  }
}
