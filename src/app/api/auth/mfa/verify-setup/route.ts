import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import prisma from "@/lib/prisma";
import {
  verifyTotpToken,
  generateBackupCodes,
  hashBackupCode,
} from "@/lib/mfa";
import { parseBody, MfaVerifySetupSchema } from "@/lib/api-schemas";
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
    const rl = await rateLimit(`mfa-verify-setup:${ip}`, {
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

    const parsed = await parseBody(request, MfaVerifySetupSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { token, encryptedSecret } = parsed;

    // Verify the TOTP token against the encrypted secret from setup
    const valid = verifyTotpToken(encryptedSecret, token);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid code. Please try again." },
        { status: 400 }
      );
    }

    // Generate and hash backup codes
    const plaintextCodes = generateBackupCodes();
    const hashedCodes = await Promise.all(plaintextCodes.map(hashBackupCode));

    // Enable MFA on the coach profile
    await prisma.coachProfile.update({
      where: { userId: session.userId },
      data: {
        mfaEnabled: true,
        mfaSecret: encryptedSecret,
        mfaBackupCodes: hashedCodes,
      },
    });

    void logAudit({
      userId: session.userId,
      action: "MFA_ENABLED",
      ...auditRequestInfo(request),
    });

    return NextResponse.json({ backupCodes: plaintextCodes });
  } catch (e) {
    logger.error("MFA verify-setup error", { context: "api", error: e });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
