import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, SALT_ROUNDS } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";
import { PasswordChangeSchema, CoachProfileUpdateSchema } from "@/lib/api-schemas";
import { logAudit, auditRequestInfo } from "@/lib/audit";

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
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    // Password change
    if (body.currentPassword || body.newPassword) {
      const result = PasswordChangeSchema.safeParse(body);
      if (!result.success) {
        const fieldErrors = result.error.issues.map((i) => ({
          field: i.path.join(".") || "_body",
          message: i.message,
        }));
        return NextResponse.json(
          { success: false, error: "Validation failed", fieldErrors },
          { status: 400 }
        );
      }
      const { currentPassword, newPassword } = result.data;

      // Rate limit password changes: 5 per minute per user
      const rl = await rateLimit(`change-password:${session.userId}`, {
        maxAttempts: 5,
        windowMs: 60_000,
      });
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
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { success: false, error: "Current password is incorrect" },
          { status: 400 }
        );
      }
      const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await prisma.user.update({
        where: { id: session.userId },
        data: { passwordHash: hash },
      });

      void logAudit({
        userId: session.userId,
        action: "PASSWORD_CHANGED",
        ...auditRequestInfo(request),
      });

      return NextResponse.json({ success: true });
    }

    // Profile update (coach)
    if (session.role === "COACH") {
      const result = CoachProfileUpdateSchema.safeParse(body);
      if (!result.success) {
        const fieldErrors = result.error.issues.map((i) => ({
          field: i.path.join(".") || "_body",
          message: i.message,
        }));
        return NextResponse.json(
          { success: false, error: "Validation failed", fieldErrors },
          { status: 400 }
        );
      }
      const profileData = result.data;
      const updateData: Record<string, string> = {};
      if (profileData.firstName !== undefined) updateData.firstName = profileData.firstName;
      if (profileData.lastName !== undefined) updateData.lastName = profileData.lastName;
      if (profileData.bio !== undefined) updateData.bio = profileData.bio;
      if (profileData.organization !== undefined)
        updateData.organization = profileData.organization;

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
