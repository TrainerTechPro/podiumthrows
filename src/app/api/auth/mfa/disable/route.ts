import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { getSession, verifyPassword, signToken, setAuthCookie, setCsrfCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTotpToken } from "@/lib/mfa";
import { parseBody, MfaDisableSchema } from "@/lib/api-schemas";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { blacklistToken } from "@/lib/token-blacklist";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rl = await rateLimit(`mfa-disable:${ip}`, {
      maxAttempts: 3,
      windowMs: 60_000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error:"Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rl.retryAfter / 1000)),
          },
        }
      );
    }

    const parsed = await parseBody(request, MfaDisableSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { password, token } = parsed;

    // Get user with password hash and coach MFA fields
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        passwordHash: true,
        coachProfile: {
          select: { id: true, mfaSecret: true, mfaEnabled: true },
        },
      },
    });

    if (
      !user ||
      !user.coachProfile?.mfaEnabled ||
      !user.coachProfile.mfaSecret
    ) {
      return NextResponse.json(
        { success: false, error:"MFA is not enabled" },
        { status: 400 }
      );
    }

    // Verify password
    if (!user.passwordHash) {
      return NextResponse.json({ success: false, error: "Account not activated" }, { status: 403 });
    }
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, error:"Invalid password" },
        { status: 401 }
      );
    }

    // Verify TOTP
    const valid = verifyTotpToken(user.coachProfile.mfaSecret, token);
    if (!valid) {
      return NextResponse.json({ success: false, error: "Invalid code" }, { status: 400 });
    }

    // Disable MFA
    await prisma.coachProfile.update({
      where: { id: user.coachProfile.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
      },
    });

    // Rotate token — MFA state changed, invalidate old sessions
    const cookieStore = await cookies();
    const oldToken = cookieStore.get("auth-token")?.value;
    if (oldToken) {
      await blacklistToken(oldToken).catch(() => {});
    }
    const newToken = signToken({
      userId: session.userId,
      email: session.email,
      role: session.role,
    });

    void logAudit({
      userId: user.id,
      action: "MFA_DISABLED",
      ...auditRequestInfo(request),
    });

    const response = NextResponse.json({ success: true });
    response.headers.append("Set-Cookie", setAuthCookie(newToken));
    response.headers.append("Set-Cookie", setCsrfCookie());
    return response;
  } catch (e) {
    logger.error("MFA disable error", { context: "api", error: e });
    return NextResponse.json(
      { success: false, error:"Server error — try again in a moment." },
      { status: 500 }
    );
  }
}
