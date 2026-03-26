import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearAuthCookie, clearCsrfCookie, getSession } from "@/lib/auth";
import { blacklistToken } from "@/lib/token-blacklist";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
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
