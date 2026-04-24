import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearAuthCookie, clearCsrfCookie, getSession } from "@/lib/auth";
import { blacklistToken } from "@/lib/token-blacklist";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  // Per-IP rate limit: 10/min. Every successful logout inserts a TokenBlacklist
  // row — unthrottled this is a DB-fill DoS vector. Key is distinct from
  // `login:` / `register:` so a legitimate burst (CSRF rotation, multi-tab
  // sign-out) doesn't starve other auth flows.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`logout:${ip}`, { maxAttempts: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many logout requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
    );
  }

  const session = await getSession();

  // Blacklist the current JWT so it can't be reused — await to guarantee invalidation
  const cookieStore = await cookies();
  const rawToken = cookieStore.get("auth-token")?.value;
  if (rawToken) {
    try {
      await blacklistToken(rawToken);
    } catch (err) {
      logger.error("Failed to blacklist token on logout", { context: "auth", error: err });
      // Continue with logout even if blacklisting fails — cookie will still be cleared
    }
  }

  const response = NextResponse.json({ success: true });
  response.headers.append("Set-Cookie", clearAuthCookie());
  response.headers.append("Set-Cookie", clearCsrfCookie());

  if (session) {
    void logAudit({
      userId: session.userId,
      action: "LOGOUT",
      ...auditRequestInfo(request),
    });
  }

  return response;
}
