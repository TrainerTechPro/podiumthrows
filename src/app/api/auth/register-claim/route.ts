import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie, setCsrfCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { parseBody, RegisterClaimSchema } from "@/lib/api-schemas";
import { hashInvitationToken } from "@/lib/invitation-token";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { notifyCoachAthleteJoined } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const auditInfo = auditRequestInfo(request);
  try {
    const ip = auditInfo.ip;
    const rl = await rateLimit(`register-claim:${ip}`, { maxAttempts: 5, windowMs: 60_000 });
    if (!rl.success) {
      void logAudit({
        action: "ATHLETE_CLAIM_ATTEMPT",
        resource: "invitation:unknown",
        metadata: { reason: "rate_limited" },
        ...auditInfo,
      });
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = await parseBody(request, RegisterClaimSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { token, email, password, firstName, lastName, events } = parsed;

    const normalizedEmail = email.toLowerCase().trim();

    // Verify token — lookup by SHA-256 hash since the DB stores only the hash.
    const invitation = await prisma.invitation.findUnique({
      where: { token: hashInvitationToken(token) },
      include: { athleteProfile: true },
    });

    if (!invitation || invitation.status !== "PENDING") {
      void logAudit({
        action: "ATHLETE_CLAIM_ATTEMPT",
        resource: invitation ? `invitation:${invitation.id}` : "invitation:unknown",
        metadata: { reason: invitation ? `status_${invitation.status}` : "token_not_found" },
        ...auditInfo,
      });
      return NextResponse.json(
        { success: false, error: "Invalid or expired invite" },
        { status: 400 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      void logAudit({
        action: "ATHLETE_CLAIM_ATTEMPT",
        resource: `invitation:${invitation.id}`,
        metadata: { reason: "expired", expiresAt: invitation.expiresAt.toISOString() },
        ...auditInfo,
      });
      return NextResponse.json(
        { success: false, error: "This invite has expired. Ask your coach to send a new one." },
        { status: 410 }
      );
    }

    if (!invitation.athleteProfileId || !invitation.athleteProfile) {
      void logAudit({
        action: "ATHLETE_CLAIM_ATTEMPT",
        resource: `invitation:${invitation.id}`,
        metadata: { reason: "no_athlete_profile" },
        ...auditInfo,
      });
      return NextResponse.json(
        { success: false, error: "This invite is not linked to an athlete profile" },
        { status: 400 }
      );
    }

    // Check email not taken by a different user
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser && existingUser.id !== invitation.athleteProfile.userId) {
      void logAudit({
        action: "ATHLETE_CLAIM_ATTEMPT",
        resource: `invitation:${invitation.id}`,
        metadata: { reason: "email_conflict" },
        ...auditInfo,
      });
      return NextResponse.json(
        { success: false, error: "Email is already in use" },
        { status: 409 }
      );
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
    // proxy profile, send the athlete to the consolidated onboarding wizard
    // in invite mode (3 visible steps, prefilled from coach data, jumps to
    // first-throw log). Otherwise run them through the full 5-step flow.
    // Both paths now land on /athlete/onboarding — the legacy /review-profile
    // route is retired.
    const profile = result.profile;
    const hasEvents = Array.isArray(profile.events) && profile.events.length > 0;
    const hasGender = !!profile.gender && profile.gender !== "OTHER";
    const redirectTo =
      hasEvents && hasGender ? "/athlete/onboarding?from=invite" : "/athlete/onboarding";

    void logAudit({
      userId: result.user.id,
      action: "ATHLETE_CLAIM_SUCCESS",
      resource: `invitation:${invitation.id}`,
      metadata: {
        athleteProfileId: result.profile.id,
        coachId: invitation.coachId,
        redirectTo,
      },
      ...auditInfo,
    });

    // In-app notification to the coach: their proxy profile has been
    // claimed. Distinct from the regular invite path (via="invite") so
    // downstream UI can distinguish new-signup vs proxy-handoff.
    void notifyCoachAthleteJoined(
      invitation.coachId,
      result.profile.id,
      `${result.profile.firstName} ${result.profile.lastName}`,
      "proxy-claim"
    ).catch((err) =>
      logger.error("Failed to create athlete-joined notification", {
        context: "api",
        error: err,
      })
    );

    const response = NextResponse.json({
      success: true,
      data: { userId: result.user.id, role: result.user.role, redirectTo },
    });

    response.headers.append("Set-Cookie", setAuthCookie(jwt));
    response.headers.append("Set-Cookie", setCsrfCookie());

    return response;
  } catch (error) {
    logger.error("Error claiming account", { context: "api", error });
    void logAudit({
      action: "ATHLETE_CLAIM_ATTEMPT",
      resource: "invitation:unknown",
      metadata: { reason: "server_error" },
      ...auditInfo,
    });
    return NextResponse.json({ success: false, error: "Failed to claim account" }, { status: 500 });
  }
}
