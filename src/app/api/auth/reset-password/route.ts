import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getToken, deleteToken } from "@/lib/resetTokenStore";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { parseBody, ResetPasswordSchema } from "@/lib/api-schemas";

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 attempts per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`reset-password:${ip}`, { maxAttempts: 5, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
      );
    }

    const parsed = await parseBody(request, ResetPasswordSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { token, password } = parsed;

    // Validate token (checks expiry and usedAt)
    const tokenData = await getToken(token);
    if (!tokenData) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    // Update password
    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: tokenData.userId },
      data: { passwordHash },
    });

    // Mark token as consumed
    await deleteToken(token);

    return NextResponse.json({
      message: "Password has been reset successfully. You can now log in.",
    });
  } catch (error) {
    logger.error("reset-password Error", { context: "api", error });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
