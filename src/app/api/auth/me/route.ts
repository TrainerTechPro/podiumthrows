import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, SALT_ROUNDS } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        coachProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            bio: true,
            organization: true,
            avatarUrl: true,
            plan: true,
            currentPeriodEnd: true,
            paymentFailedAt: true,
            cancelAtPeriodEnd: true,
            enabledModules: true,
            _count: { select: { athletes: true } },
          },
        },
        athleteProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            events: true,
            gender: true,
            dateOfBirth: true,
            avatarUrl: true,
            currentStreak: true,
            longestStreak: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();

    // Password change
    if (body.currentPassword && body.newPassword) {
      // Rate limit password changes: 5 per minute per user
      const rl = await rateLimit(`change-password:${session.userId}`, { maxAttempts: 5, windowMs: 60_000 });
      if (!rl.success) {
        return NextResponse.json(
          { success: false, error: "Too many requests. Please try again later." },
          { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { passwordHash: true },
      });
      if (!user) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }
      const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 400 });
      }
      const hash = await bcrypt.hash(body.newPassword, SALT_ROUNDS);
      await prisma.user.update({
        where: { id: session.userId },
        data: { passwordHash: hash },
      });
      return NextResponse.json({ success: true });
    }

    // Profile update (coach)
    if (session.role === "COACH") {
      const updateData: Record<string, string> = {};
      if (body.firstName !== undefined) updateData.firstName = body.firstName;
      if (body.lastName !== undefined) updateData.lastName = body.lastName;
      if (body.bio !== undefined) updateData.bio = body.bio;
      if (body.organization !== undefined) updateData.organization = body.organization;

      if (Object.keys(updateData).length > 0) {
        await prisma.coachProfile.update({
          where: { userId: session.userId },
          data: updateData,
        });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
