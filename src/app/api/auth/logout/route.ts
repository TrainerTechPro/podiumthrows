import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearAuthCookie, clearCsrfCookie, getSession } from "@/lib/auth";
import { blacklistToken } from "@/lib/token-blacklist";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

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

  // Blacklist the current JWT so it can't be reused. The cookie is cleared
  // regardless of outcome (below), but clearing the cookie only protects the
  // honest user — a captured copy of the JWT stays cryptographically valid
  // until its 7-day expiry unless it lands in the blacklist. So a failed
  // blacklist write is a real, security-relevant degradation that must surface,
  // not be swallowed as a successful logout.
  const cookieStore = await cookies();
  const rawToken = cookieStore.get("auth-token")?.value;
  const tokenInvalidated = rawToken ? await blacklistWithRetry(rawToken) : true;

  const response = tokenInvalidated
    ? NextResponse.json({ success: true })
    : NextResponse.json(
        {
          success: false,
          error:
            "You’ve been signed out, but we couldn’t fully revoke this session. If you’re on a shared device, contact support.",
        },
        // 500 so the failure isn't masked as success. Both logout callers
        // redirect/reload regardless of status (DashboardLayout → /login,
        // claim LogoutButton → hard reload), so the user is still signed out
        // client-side — this status is for monitoring + an honest API contract.
        { status: 500 }
      );

  // Always clear the browser session, success or degraded.
  response.headers.append("Set-Cookie", clearAuthCookie());
  response.headers.append("Set-Cookie", clearCsrfCookie());

  if (session) {
    void logAudit({
      userId: session.userId,
      action: "LOGOUT",
      ...auditRequestInfo(request),
      // Forensic trail: a logout that couldn't revoke the JWT is exactly the
      // window an attacker would replay a stolen token in. Flag it durably in
      // the audit log, not just Sentry.
      ...(tokenInvalidated ? {} : { metadata: { tokenInvalidated: false } }),
    });
  }

  return response;
}

/**
 * Blacklist a token, retrying once to absorb a transient DB blip (pool timeout,
 * connection reset) — common on serverless and exactly the kind of failure that
 * would otherwise leave a token live for 7 days. The upsert in blacklistToken is
 * idempotent, so re-running after a partial success is safe. Returns true if the
 * token is confirmed blacklisted, false if every attempt failed (already logged
 * + reported to Sentry inside blacklistToken).
 */
async function blacklistWithRetry(token: string, attempts = 2): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      await blacklistToken(token);
      return true;
    } catch {
      // blacklistToken already logged + captured to Sentry. Swallow here so the
      // loop can retry; the final failure is surfaced by the caller's 500 path.
      if (i === attempts - 1) return false;
    }
  }
  return false;
}
