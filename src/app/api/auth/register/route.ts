import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 attempts per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRateLimit(`register:${ip}`, 3, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } }
      );
    }

    const body = await request.json();
    const { email, password, firstName, lastName, role, inviteToken } = body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (!["COACH", "ATHLETE"].includes(role)) {
      return NextResponse.json(
        { error: "Role must be COACH or ATHLETE" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

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
        include: { coach: true },
      });

      if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
        return NextResponse.json(
          { error: "Invalid or expired invitation" },
          { status: 400 }
        );
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
          },
        });
      } else if (role === "ATHLETE") {
        if (!invitation) {
          return NextResponse.json(
            { error: "Athletes must register via an invitation link from their coach" },
            { status: 400 }
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
        redirectTo: user.role === "COACH" ? "/coach/dashboard" : "/athlete/onboarding",
      },
      { status: 201 }
    );

    response.headers.set("Set-Cookie", setAuthCookie(token));

    return response;
  } catch (error) {
    console.error("[register] Registration failed:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
