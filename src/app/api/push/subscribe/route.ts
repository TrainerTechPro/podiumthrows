/**
 * Web Push subscribe / unsubscribe.
 *
 * POST — upserts a PushSubscription for the current user (keyed on the
 *        unique endpoint so re-subscribing from the same browser is
 *        idempotent).
 * DELETE — removes the subscription matching a given endpoint for
 *          the current user.
 *
 * Both endpoints require an authenticated session. The subscription
 * payload comes from the browser's `PushManager.subscribe()` return
 * value — already serialized to JSON.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

type SubscribeBody = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  expirationTime?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as SubscribeBody;

    const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
    const p256dh = body.keys && typeof body.keys.p256dh === "string" ? body.keys.p256dh : null;
    const authSecret = body.keys && typeof body.keys.auth === "string" ? body.keys.auth : null;

    if (!endpoint || !p256dh || !authSecret) {
      return NextResponse.json(
        { success: false, error: "endpoint, keys.p256dh, and keys.auth are required." },
        { status: 400 }
      );
    }

    const expirationTime =
      typeof body.expirationTime === "number" ? new Date(body.expirationTime) : null;

    const userAgent = req.headers.get("user-agent") ?? null;

    // Upsert keyed on endpoint — the same browser re-subscribing updates
    // its keys in place rather than creating duplicate rows.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: session.userId,
        endpoint,
        p256dh,
        authSecret,
        expirationTime,
        userAgent,
      },
      update: {
        userId: session.userId,
        p256dh,
        authSecret,
        expirationTime,
        userAgent,
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: { subscribed: true } });
  } catch (err) {
    logger.error("POST /api/push/subscribe", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to save subscription." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { endpoint?: unknown };
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
    if (!endpoint) {
      return NextResponse.json({ success: false, error: "endpoint is required." }, { status: 400 });
    }

    // Only delete if the subscription actually belongs to this user
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.userId },
    });

    return NextResponse.json({ success: true, data: { unsubscribed: true } });
  } catch (err) {
    logger.error("DELETE /api/push/subscribe", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to remove subscription." },
      { status: 500 }
    );
  }
}
