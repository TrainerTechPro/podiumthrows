import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { generateMfaSecret } from "@/lib/mfa";
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
    const rl = await rateLimit(`mfa-setup:${ip}`, {
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

    const { secret, encryptedSecret, qrCodeDataUrl } =
      await generateMfaSecret(session.email);

    void logAudit({
      userId: session.userId,
      action: "MFA_SETUP_INITIATED",
      ...auditRequestInfo(request),
    });

    return NextResponse.json({ qrCodeDataUrl, secret, encryptedSecret });
  } catch (e) {
    logger.error("MFA setup error", { context: "api", error: e });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
