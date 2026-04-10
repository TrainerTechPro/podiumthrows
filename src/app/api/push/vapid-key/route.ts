/**
 * GET /api/push/vapid-key
 *
 * Returns the VAPID public key the client needs to create a subscription.
 * This is safe to expose — the public key is literally the "public" half
 * of the VAPID keypair. The private key stays on the server.
 *
 * Client flow:
 *   1. GET /api/push/vapid-key → { publicKey }
 *   2. navigator.serviceWorker.ready → subscribe with the key
 *   3. POST /api/push/subscribe with the returned subscription
 */

import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { success: false, error: "Push notifications are not configured on this server." },
      { status: 501 }
    );
  }
  return NextResponse.json({ publicKey });
}
