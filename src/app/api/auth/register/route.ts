import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie, setCsrfCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { PLAN_LIMITS } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { parseBody, RegisterSchema } from "@/lib/api-schemas";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { sendWelcomeEmail, sendAthleteJoinedEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 attempts per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`register:${ip}`, { maxAttempts: 3, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
      );
    }

    const parsed = await parseBody(request, RegisterSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { email, password, firstName, lastName, role, inviteToken, leadId, plan, interval } =
      parsed;

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // If registering as athlete via invitation, validate the token
    let invitation = null;
    if (role === "ATHLETE" && inviteToken) {
      invitation = await prisma.invitation.findUnique({
        where: { token: inviteToken },
        include: { coach: { include: { user: { select: { email: true } } } } },
      });

      if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
        return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 400 });
      }
    }

    const passwordHash = await hashPassword(password);

    // Create user + profile in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          role,
        },
      });

      if (role === "COACH") {
        await tx.coachProfile.create({
          data: {
            userId: newUser.id,
            firstName,
            lastName,
            plan: "FREE",
            leadId: leadId || null,
          },
        });
      } else if (role === "ATHLETE") {
        if (!invitation) {
          return NextResponse.json(
            { error: "Athletes must register via an invitation link from their coach" },
            { status: 400 }
          );
        }

        // Enforce plan limit — prevents accepting invitations issued before a downgrade
        // Exclude self-coached athlete created by Training Mode from the count
        const coach = await tx.coachProfile.findUnique({
          where: { id: invitation.coachId },
          select: { plan: true },
        });
        const realAthleteCount = coach
          ? await tx.athleteProfile.count({
              where: { coachId: invitation.coachId, isSelfCoached: false },
            })
          : 0;
        if (coach && realAthleteCount >= (PLAN_LIMITS[coach.plan] ?? 3)) {
          return NextResponse.json(
            { error: "Coach has reached their plan's athlete limit" },
            { status: 403 }
          );
        }

        await tx.athleteProfile.create({
          data: {
            userId: newUser.id,
            coachId: invitation.coachId,
            firstName,
            lastName,
            events: [],
            gender: "OTHER",
          },
        });

        // Mark invitation as accepted
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED" },
        });
      }

      return newUser;
    });

    // Handle case where transaction returns a NextResponse (error)
    if (user instanceof NextResponse) {
      return user;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        redirectTo:
          user.role === "COACH"
            ? plan
              ? `/coach/dashboard?checkout=${plan}${interval === "annual" ? "&interval=annual" : ""}`
              : "/coach/onboarding/welcome"
            : "/athlete/onboarding",
      },
      { status: 201 }
    );

    response.headers.append("Set-Cookie", setAuthCookie(token));
    response.headers.append("Set-Cookie", setCsrfCookie());

    void logAudit({
      userId: user.id,
      action: "REGISTER_SUCCESS",
      metadata: { role: user.role, email: user.email },
      ...auditRequestInfo(request),
    });

    // Fire-and-forget emails — never block the response
    if (role === "COACH") {
      sendWelcomeEmail(normalizedEmail, firstName, "COACH").catch((err) =>
        logger.error("Failed to send coach welcome email", { context: "api", error: err })
      );
    } else if (role === "ATHLETE" && invitation) {
      const coachName = `${invitation.coach.firstName} ${invitation.coach.lastName}`;
      sendWelcomeEmail(normalizedEmail, firstName, "ATHLETE", coachName).catch((err) =>
        logger.error("Failed to send athlete welcome email", { context: "api", error: err })
      );
      sendAthleteJoinedEmail(invitation.coach.user.email, `${firstName} ${lastName}`).catch((err) =>
        logger.error("Failed to send athlete-joined email", { context: "api", error: err })
      );
    }

    return response;
  } catch (error) {
    logger.error("register Registration failed", { context: "api", error });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
