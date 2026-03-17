import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTotpToken } from "@/lib/mfa";
import { parseBody, MfaDisableSchema } from "@/lib/api-schemas";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        { error: "Too many requests. Please try again later." },
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
        { error: "MFA is not enabled" },
        { status: 400 }
      );
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Verify TOTP
    const valid = verifyTotpToken(user.coachProfile.mfaSecret, token);
    if (!valid) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
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

    void logAudit({
      userId: user.id,
      action: "MFA_DISABLED",
      ...auditRequestInfo(request),
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error("MFA disable error", { context: "api", error: e });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
