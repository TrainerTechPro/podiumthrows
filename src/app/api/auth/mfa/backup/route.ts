import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signToken, setAuthCookie, setCsrfCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { verifyMfaSessionToken, verifyBackupCode } from "@/lib/mfa";
import { parseBody, MfaBackupSchema } from "@/lib/api-schemas";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rl = await rateLimit(`mfa-backup:${ip}`, {
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

    const parsed = await parseBody(request, MfaBackupSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { mfaSessionToken, code } = parsed;

    // Verify MFA session token
    let mfaSession: { userId: string };
    try {
      mfaSession = verifyMfaSessionToken(mfaSessionToken);
    } catch {
      return NextResponse.json(
        { error: "MFA session expired. Please log in again." },
        { status: 401 }
      );
    }

    // Look up user + coach profile with backup codes
    const user = await prisma.user.findUnique({
      where: { id: mfaSession.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isAdmin: true,
        coachProfile: {
          select: { id: true, mfaEnabled: true, mfaBackupCodes: true },
        },
      },
    });

    if (!user || !user.coachProfile?.mfaEnabled) {
      return NextResponse.json(
        { error: "MFA not configured" },
        { status: 400 }
      );
    }

    // Check each hashed backup code
    const hashedCodes = user.coachProfile.mfaBackupCodes;
    let matchedIndex = -1;

    for (let i = 0; i < hashedCodes.length; i++) {
      const match = await verifyBackupCode(code, hashedCodes[i]);
      if (match) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) {
      void logAudit({
        userId: user.id,
        action: "MFA_BACKUP_FAILED",
        ...auditRequestInfo(request),
      });
      return NextResponse.json(
        { error: "Invalid backup code" },
        { status: 400 }
      );
    }

    // Remove the used backup code
    const remainingCodes = [...hashedCodes];
    remainingCodes.splice(matchedIndex, 1);

    await prisma.coachProfile.update({
      where: { id: user.coachProfile.id },
      data: { mfaBackupCodes: remainingCodes },
    });

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
      remainingBackupCodes: remainingCodes.length,
    });

    response.headers.append("Set-Cookie", setAuthCookie(authToken));
    response.headers.append("Set-Cookie", setCsrfCookie());

    void logAudit({
      userId: user.id,
      action: "MFA_BACKUP_USED",
      metadata: { remainingCodes: remainingCodes.length },
      ...auditRequestInfo(request),
    });

    return response;
  } catch (e) {
    logger.error("MFA backup verify error", { context: "api", error: e });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
