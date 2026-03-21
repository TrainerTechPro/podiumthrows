import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/* ─── POST — first-time Training Mode activation ─────────────────────────── */

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        events: true,
        trainingEnabled: true,
      },
    });

    if (!coach) {
      return NextResponse.json({ error: "Coach profile not found." }, { status: 404 });
    }

    if (coach.trainingEnabled) {
      return NextResponse.json({ error: "Training Mode is already enabled." }, { status: 400 });
    }

    // Create self-coached AthleteProfile and enable training mode atomically
    const [athleteProfile] = await prisma.$transaction([
      prisma.athleteProfile.create({
        data: {
          userId: session.userId,
          coachId: coach.id,
          firstName: coach.firstName,
          lastName: coach.lastName,
          events: coach.events,
          gender: "OTHER",
          isSelfCoached: true,
        },
        select: { id: true },
      }),
      prisma.coachProfile.update({
        where: { id: coach.id },
        data: { trainingEnabled: true },
      }),
      prisma.user.update({
        where: { id: session.userId },
        data: { activeMode: "TRAINING" },
      }),
    ]);

    const isProduction = process.env.NODE_ENV === "production";
    const cookieValue = [
      "active-mode=TRAINING",
      "Path=/",
      "SameSite=Strict",
      "Max-Age=31536000", // 1 year
      ...(isProduction ? ["Secure"] : []),
    ].join("; ");

    const response = NextResponse.json(
      { ok: true, data: { athleteId: athleteProfile.id } },
      { status: 201 }
    );
    response.headers.append("Set-Cookie", cookieValue);
    return response;
  } catch (err) {
    logger.error("POST /api/coach/training-mode", { context: "api", error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
