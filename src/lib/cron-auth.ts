import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Constant-time string comparison that never short-circuits on length.
 * timingSafeEqual throws if the two buffers differ in length, so we hash both
 * sides to a fixed width first — this keeps the comparison constant-time without
 * leaking length information about the expected secret.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ah = crypto.createHash("sha256").update(a).digest();
  const bh = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ah, bh);
}

/**
 * Shared guard for Vercel Cron routes.
 *
 * Every `/api/cron/*` route is authenticated via `Authorization: Bearer ${CRON_SECRET}`.
 * Returns a `NextResponse` (the error to return) when auth fails, or `null` when the
 * request is authorized and the handler should proceed:
 *
 *   const denied = assertCronAuth(req);
 *   if (denied) return denied;
 *
 * Fails closed when `CRON_SECRET` is unset (500) and uses a constant-time comparison
 * so the secret can't be recovered by timing the response.
 */
export function assertCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !timingSafeEqualStr(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
