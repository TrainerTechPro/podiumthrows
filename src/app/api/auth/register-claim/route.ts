import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie, setCsrfCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { parseBody, RegisterClaimSchema } from "@/lib/api-schemas";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`register-claim:${ip}`, { maxAttempts: 5, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = await parseBody(request, RegisterClaimSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { token, email, password, firstName, lastName, events } = parsed;

    const normalizedEmail = email.toLowerCase().trim();

    // Verify token
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { athleteProfile: true },
    });

    if (!invitation || invitation.status !== "PENDING") {
      return NextResponse.json({ success: false, error: "Invalid or expired invite" }, { status: 400 });
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: "This invite has expired. Ask your coach to send a new one." },
        { status: 410 }
      );
    }

    if (!invitation.athleteProfileId || !invitation.athleteProfile) {
      return NextResponse.json({ success: false, error: "This invite is not linked to an athlete profile" }, { status: 400 });
    }

    // Check email not taken by a different user
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser && existingUser.id !== invitation.athleteProfile.userId) {
      return NextResponse.json({ success: false, error: "Email is already in use" }, { status: 409 });
    }

    const hashed = await hashPassword(password);

    // Update placeholder user and profile in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: invitation.athleteProfile!.userId },
        data: {
          email: normalizedEmail,
          passwordHash: hashed,
          claimedAt: new Date(),
        },
      });

      const profile = await tx.athleteProfile.update({
        where: { id: invitation.athleteProfileId! },
        data: {
          ...(firstName?.trim() ? { firstName: firstName.trim() } : {}),
          ...(lastName?.trim() ? { lastName: lastName.trim() } : {}),
          ...(Array.isArray(events) && events.length > 0 ? { events } : {}),
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      return { user, profile };
    });

    // Create JWT and set cookie
    const jwt = signToken({
      userId: result.user.id,
      role: result.user.role,
      email: result.user.email,
    });

    // Determine redirect target based on coach-populated data.
    // If the coach populated the basics (events + non-OTHER gender) on the
    // proxy profile, send the athlete straight to the review page so they can
    // confirm and edit. Otherwise run them through onboarding to collect those
    // fields from scratch.
    const profile = result.profile;
    const hasEvents = Array.isArray(profile.events) && profile.events.length > 0;
    const hasGender = !!profile.gender && profile.gender !== "OTHER";
    const redirectTo =
      hasEvents && hasGender ? "/athlete/review-profile" : "/athlete/onboarding";

    const response = NextResponse.json({
      success: true,
      data: { userId: result.user.id, role: result.user.role, redirectTo },
    });

    response.headers.append("Set-Cookie", setAuthCookie(jwt));
    response.headers.append("Set-Cookie", setCsrfCookie());

    return response;
  } catch (error) {
    logger.error("Error claiming account", { context: "api", error });
    return NextResponse.json({ success: false, error: "Failed to claim account" }, { status: 500 });
  }
}
