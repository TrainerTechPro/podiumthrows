import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, signToken, setAuthCookie, setCsrfCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { parseBody, LoginSchema } from "@/lib/api-schemas";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { signMfaSessionToken } from "@/lib/mfa";

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 attempts per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`login:${ip}`, { maxAttempts: 5, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
      );
    }

    const parsed = await parseBody(request, LoginSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { email, password } = parsed;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
        isAdmin: true,
        coachProfile: { select: { mfaEnabled: true } },
      },
    });

    const reqInfo = auditRequestInfo(request);

    if (!user) {
      void logAudit({
        action: "LOGIN_FAILED",
        metadata: { email: email.toLowerCase().trim(), reason: "user_not_found" },
        ...reqInfo,
      });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      void logAudit({
        userId: user.id,
        action: "LOGIN_FAILED",
        metadata: { email: user.email, reason: "wrong_password" },
        ...reqInfo,
      });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
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

      return NextResponse.json({ requiresMfa: true, mfaSessionToken });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      ...(user.isAdmin ? { isAdmin: true } : {}),
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      redirectTo: user.role === "COACH" ? "/coach/dashboard" : "/athlete/dashboard",
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
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
