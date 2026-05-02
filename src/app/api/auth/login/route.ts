import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, verifyPassword, signToken, setAuthCookie, setCsrfCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { parseBody, LoginSchema } from "@/lib/api-schemas";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { signMfaSessionToken } from "@/lib/mfa";

// Pre-computed dummy hash for timing-safe comparison when user doesn't exist.
// This ensures consistent response time regardless of whether the email is registered.
let DUMMY_HASH: string | null = null;
async function getDummyHash(): Promise<string> {
  if (!DUMMY_HASH) {
    DUMMY_HASH = await hashPassword("timing-safe-dummy-password");
  }
  return DUMMY_HASH;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 attempts per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`login:${ip}`, { maxAttempts: 5, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
      );
    }

    const parsed = await parseBody(request, LoginSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { email, password } = parsed;

    const normalizedEmail = email.toLowerCase().trim();

    // Per-account rate limit: 10 attempts per 15 minutes (protects against distributed stuffing)
    const accountRl = await rateLimit(`login:email:${normalizedEmail}`, {
      maxAttempts: 10,
      windowMs: 15 * 60_000,
    });
    if (!accountRl.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many login attempts for this account. Please try again later.",
        },
        { status: 429, headers: { "Retry-After": String(Math.ceil(accountRl.retryAfter / 1000)) } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
        isAdmin: true,
        deletedAt: true,
        deleteScheduledFor: true,
        coachProfile: { select: { mfaEnabled: true } },
      },
    });

    const reqInfo = auditRequestInfo(request);

    // Always run bcrypt comparison to prevent timing-based email enumeration.
    // For missing users or unclaimed accounts, compare against a dummy hash.
    const hashToCompare = user?.passwordHash || (await getDummyHash());
    const passwordValid = await verifyPassword(password, hashToCompare);

    if (!user) {
      void logAudit({
        action: "LOGIN_FAILED",
        metadata: { email: normalizedEmail, reason: "user_not_found" },
        ...reqInfo,
      });
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Unclaimed placeholder accounts have no password — reject login
    if (!user.passwordHash) {
      void logAudit({
        userId: user.id,
        action: "LOGIN_FAILED",
        metadata: { email: user.email, reason: "unclaimed_account" },
        ...reqInfo,
      });
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!passwordValid) {
      void logAudit({
        userId: user.id,
        action: "LOGIN_FAILED",
        metadata: { email: user.email, reason: "wrong_password" },
        ...reqInfo,
      });
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // MFA check — coaches with MFA enabled get a short-lived token instead of full JWT
    if (user.role === "COACH" && user.coachProfile?.mfaEnabled) {
      const mfaSessionToken = signMfaSessionToken(user.id);

      void logAudit({
        userId: user.id,
        action: "MFA_REQUIRED",
        metadata: { email: user.email },
        ...reqInfo,
      });

      return NextResponse.json({ success: true, data: { requiresMfa: true, mfaSessionToken } });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      ...(user.isAdmin ? { isAdmin: true } : {}),
    });

    // If the account is in the soft-delete grace window, surface that to
    // the client so the UI can offer a Restore CTA. The session is still
    // issued normally — the user can log in and use the app, and either
    // hit POST /api/me/restore to cancel the pending deletion or let the
    // hard-delete cron eventually remove the row.
    const pendingDeletion =
      user.deletedAt && user.deleteScheduledFor && user.deleteScheduledFor.getTime() > Date.now()
        ? {
            deletedAt: user.deletedAt.toISOString(),
            deleteScheduledFor: user.deleteScheduledFor.toISOString(),
          }
        : null;

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        redirectTo: pendingDeletion
          ? "/account-restore"
          : user.role === "COACH"
            ? "/coach/dashboard"
            : "/athlete/dashboard",
        ...(pendingDeletion ? { pendingDeletion } : {}),
      },
    });

    response.headers.append("Set-Cookie", setAuthCookie(token));
    response.headers.append("Set-Cookie", setCsrfCookie());

    void logAudit({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      metadata: { role: user.role },
      ...reqInfo,
    });

    return response;
  } catch (e) {
    logger.error("login error", { context: "api", error: e });
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
