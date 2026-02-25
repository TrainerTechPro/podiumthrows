import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { resetTokens } from "@/app/api/auth/forgot-password/route";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and new password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Validate token
    const tokenData = resetTokens.get(token);
    if (!tokenData || tokenData.expiresAt < new Date()) {
      resetTokens.delete(token);
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

    // Invalidate token
    resetTokens.delete(token);

    return NextResponse.json({
      message: "Password has been reset successfully. You can now log in.",
    });
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
