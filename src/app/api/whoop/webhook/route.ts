import { NextRequest, NextResponse } from "next/server";
import { syncWhoopData } from "@/lib/whoop/sync";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import crypto from "crypto";

const WHOOP_WEBHOOK_SECRET = process.env.WHOOP_WEBHOOK_SECRET;

/**
 * Verify the WHOOP webhook signature (HMAC-SHA256).
 * Returns true if valid or if no secret is configured (local dev).
 */
async function verifyWhoopSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!WHOOP_WEBHOOK_SECRET) {
    // Fail CLOSED in production: an unsigned webhook with no configured secret
    // would let anyone POST forged wellness data. Only skip verification in dev,
    // matching the Stripe / video-processing webhooks. See CLAUDE.md security notes.
    if (process.env.NODE_ENV === "production") {
      logger.error("WHOOP webhook: WHOOP_WEBHOOK_SECRET not set in production — rejecting", {
        context: "api",
      });
      return false;
    }
    logger.warn(
      "WHOOP webhook: WHOOP_WEBHOOK_SECRET not set, skipping signature verification (dev only)",
      {
        context: "api",
      }
    );
    return true;
  }
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", WHOOP_WEBHOOK_SECRET).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * POST /api/whoop/webhook
 * Receives webhook events from WHOOP when new data is available.
 * This is a public route — CSRF is skipped in middleware.
 * Always returns 200 to prevent WHOOP from retrying.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify HMAC signature before processing
    const signature = request.headers.get("x-whoop-signature");
    const isValid = await verifyWhoopSignature(rawBody, signature);
    if (!isValid) {
      logger.warn("WHOOP webhook: invalid signature", { context: "api" });
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    // WHOOP webhook payload includes user_id (integer) and type
    const whoopUserId = body?.user_id as number | undefined;
    if (!whoopUserId) {
      logger.warn("WHOOP webhook: missing user_id", {
        context: "api",
        metadata: { body },
      });
      return NextResponse.json({ success: true });
    }

    // Look up connection by WHOOP user ID
    const connection = await prisma.whoopConnection.findFirst({
      where: { whoopUserId },
      select: { id: true },
    });

    if (!connection) {
      // User may have disconnected — acknowledge silently
      return NextResponse.json({ success: true });
    }

    await syncWhoopData(connection.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("POST /api/whoop/webhook", { context: "api", error: err });
    // Always return 200 so WHOOP doesn't retry
    return NextResponse.json({ success: true });
  }
}
