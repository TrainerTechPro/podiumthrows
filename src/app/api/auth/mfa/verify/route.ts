import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signToken, setAuthCookie, setCsrfCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { verifyMfaSessionToken, verifyTotpToken } from "@/lib/mfa";
import { parseBody, MfaVerifySchema } from "@/lib/api-schemas";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rl = await rateLimit(`mfa-verify:${ip}`, {
      maxAttempts: 5,
      windowMs: 60_000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rl.retryAfter / 1000)),
          },
        }
      );
    }

    const parsed = await parseBody(request, MfaVerifySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { mfaSessionToken, token } = parsed;

    // Verify the short-lived MFA session token
    let mfaSession: { userId: string };
    try {
      mfaSession = verifyMfaSessionToken(mfaSessionToken);
    } catch {
      return NextResponse.json(
        { error: "MFA session expired. Please log in again." },
        { status: 401 }
      );
    }

    // Look up user + coach profile
    const user = await prisma.user.findUnique({
      where: { id: mfaSession.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isAdmin: true,
        coachProfile: { select: { mfaSecret: true, mfaEnabled: true } },
      },
    });

    if (
      !user ||
      !user.coachProfile?.mfaEnabled ||
      !user.coachProfile.mfaSecret
    ) {
      return NextResponse.json(
        { error: "MFA not configured" },
        { status: 400 }
      );
    }

    // Verify the TOTP token
    const valid = verifyTotpToken(user.coachProfile.mfaSecret, token);
    if (!valid) {
      void logAudit({
        userId: user.id,
        action: "MFA_VERIFY_FAILED",
        metadata: { reason: "invalid_totp" },
        ...auditRequestInfo(request),
      });
      return NextResponse.json(
        { error: "Invalid code. Please try again." },
        { status: 400 }
      );
    }

    // Issue full JWT
    const authToken = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      ...(user.isAdmin ? { isAdmin: true } : {}),
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role },
      redirectTo: "/coach/dashboard",
    });

    response.headers.append("Set-Cookie", setAuthCookie(authToken));
    response.headers.append("Set-Cookie", setCsrfCookie());

    void logAudit({
      userId: user.id,
      action: "MFA_VERIFIED",
      ...auditRequestInfo(request),
    });

    return response;
  } catch (e) {
    logger.error("MFA verify error", { context: "api", error: e });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
