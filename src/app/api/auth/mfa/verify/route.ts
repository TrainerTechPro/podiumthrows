import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signToken, setAuthCookie, setCsrfCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { verifyMfaSessionToken, verifyTotpToken } from "@/lib/mfa";
import { parseBody, MfaVerifySchema } from "@/lib/api-schemas";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { blacklistToken, isBlacklisted } from "@/lib/token-blacklist";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`mfa-verify:${ip}`, {
      maxAttempts: 5,
      windowMs: 60_000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
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
        { success: false, error: "MFA session expired. Please log in again." },
        { status: 401 }
      );
    }

    // Reject tokens already consumed by a prior successful verify — prevents replay
    // inside the JWT's 5-min natural expiry window.
    if (await isBlacklisted(mfaSessionToken)) {
      void logAudit({
        userId: mfaSession.userId,
        action: "MFA_VERIFY_FAILED",
        metadata: { reason: "replayed_session_token" },
        ...auditRequestInfo(request),
      });
      return NextResponse.json(
        { success: false, error: "MFA session expired. Please log in again." },
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

    if (!user || !user.coachProfile?.mfaEnabled || !user.coachProfile.mfaSecret) {
      return NextResponse.json({ success: false, error: "MFA not configured" }, { status: 400 });
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
        { success: false, error: "Invalid code. Please try again." },
        { status: 400 }
      );
    }

    // Consume the MFA session token before issuing the final auth cookie. If the
    // blacklist write fails we refuse to continue — better to force the user back
    // through login than to hand out an auth cookie against a still-replayable token.
    try {
      await blacklistToken(mfaSessionToken);
    } catch (err) {
      logger.error("Couldn’t consume MFA session token â aborting verify", {
        context: "auth",
        error: err,
      });
      return NextResponse.json(
        { success: false, error: "Server error — try again in a moment." },
        { status: 500 }
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
      success: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role },
        redirectTo: "/coach/dashboard",
      },
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
      { success: false, error: "Server error — try again in a moment." },
      { status: 500 }
    );
  }
}
