import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { getSession, signToken, setAuthCookie, setCsrfCookie, SALT_ROUNDS } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";
import { PasswordChangeSchema, CoachProfileUpdateSchema } from "@/lib/api-schemas";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { blacklistToken } from "@/lib/token-blacklist";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
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
            trainingEnabled: true,
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
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { user } });
  } catch (err) {
    logger.error("GET /api/auth/me", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Server error — try again in a moment." },
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

    // INTENTIONAL EXEMPTION from parseBody: PATCH /api/auth/me dispatches on
    // body shape — `currentPassword`/`newPassword` triggers the password-
    // change branch, anything else is a coach-profile update. Both branches
    // run the matching Zod schema's safeParse and return the canonical
    // `{ success: false, error: "Validation failed", fieldErrors }` shape
    // that `parseBody` itself emits — the validation surface is identical.
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const wantsPasswordChange = body.currentPassword != null || body.newPassword != null;

    // Password change branch
    if (wantsPasswordChange) {
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
      if (!user.passwordHash) {
        return NextResponse.json(
          { success: false, error: "Account has no password set" },
          { status: 400 }
        );
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

      // Rotate token — blacklist old JWT and issue a fresh one
      const cookieStore = await cookies();
      const oldToken = cookieStore.get("auth-token")?.value;
      if (oldToken) {
        await blacklistToken(oldToken).catch(() => {});
      }
      const newToken = signToken({
        userId: session.userId,
        email: session.email,
        role: session.role,
      });

      void logAudit({
        userId: session.userId,
        action: "PASSWORD_CHANGED",
        ...auditRequestInfo(request),
      });

      const response = NextResponse.json({ success: true });
      response.headers.append("Set-Cookie", setAuthCookie(newToken));
      response.headers.append("Set-Cookie", setCsrfCookie());
      return response;
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
      const updateData: Record<string, string | null> = {};
      if (profileData.firstName !== undefined) updateData.firstName = profileData.firstName;
      if (profileData.lastName !== undefined) updateData.lastName = profileData.lastName;
      if (profileData.bio !== undefined) updateData.bio = profileData.bio;
      if (profileData.organization !== undefined)
        updateData.organization = profileData.organization;

      if (Object.keys(updateData).length > 0) {
        const updated = await prisma.coachProfile.update({
          where: { userId: session.userId },
          data: updateData,
          select: { trainingEnabled: true },
        });

        // Sync name changes to self-coached AthleteProfile
        if (updated.trainingEnabled && (updateData.firstName || updateData.lastName)) {
          const syncData: Record<string, string> = {};
          if (updateData.firstName) syncData.firstName = updateData.firstName;
          if (updateData.lastName) syncData.lastName = updateData.lastName;
          await prisma.athleteProfile.updateMany({
            where: { userId: session.userId, isSelfCoached: true },
            data: syncData,
          });
        }
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
  } catch (err) {
    logger.error("PATCH /api/auth/me", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Server error — try again in a moment." },
      { status: 500 }
    );
  }
}
