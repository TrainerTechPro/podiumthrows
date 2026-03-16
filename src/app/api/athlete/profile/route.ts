import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  COMPETITION_WEIGHTS,
  EVENT_CODE_MAP,
  GENDER_CODE_MAP,
  type ThrowEvent,
  type Gender,
} from "@/lib/throws/constants";

/* ─── GET — return own profile ────────────────────────────────────────────── */

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        events: true,
        gender: true,
        dateOfBirth: true,
        avatarUrl: true,
        heightCm: true,
        weightKg: true,
        currentStreak: true,
        longestStreak: true,
      },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...athlete,
      dateOfBirth: athlete.dateOfBirth?.toISOString() ?? null,
    });
  } catch (err) {
    logger.error("GET /api/athlete/profile", { context: "api", error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* ─── PATCH — update profile ──────────────────────────────────────────────── */

type CompetitionPB = { event: string; distance: number };

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      firstName,
      lastName,
      events,
      gender,
      dateOfBirth,
      heightCm,
      weightKg,
      competitionPBs,
      completeOnboarding,
    } = body as Record<string, unknown>;

    if (
      typeof firstName !== "string" || firstName.trim().length === 0 ||
      typeof lastName !== "string" || lastName.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "First name and last name are required." },
        { status: 400 }
      );
    }

    // Get athlete ID for ThrowLog creation
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, gender: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const updated = await prisma.athleteProfile.update({
      where: { userId: session.userId },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        events: Array.isArray(events) ? (events as never[]) : undefined,
        gender: typeof gender === "string" ? (gender as never) : undefined,
        dateOfBirth:
          typeof dateOfBirth === "string" && dateOfBirth
            ? new Date(dateOfBirth)
            : null,
        heightCm: typeof heightCm === "number" ? heightCm : null,
        weightKg: typeof weightKg === "number" ? weightKg : null,
        ...(completeOnboarding === true && {
          onboardingCompletedAt: new Date(),
        }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        events: true,
        gender: true,
        dateOfBirth: true,
        heightCm: true,
        weightKg: true,
      },
    });

    // Create ThrowLog entries for competition PBs submitted during onboarding
    if (Array.isArray(competitionPBs) && competitionPBs.length > 0) {
      const resolvedGender = (typeof gender === "string" ? gender : athlete.gender) as Gender;
      const genderCode = GENDER_CODE_MAP[resolvedGender] ?? "M";

      const pbEntries = (competitionPBs as CompetitionPB[])
        .filter((pb) => pb.event && typeof pb.distance === "number" && pb.distance > 0)
        .map((pb) => {
          const eventCode = EVENT_CODE_MAP[pb.event as ThrowEvent];
          const compWeight = eventCode
            ? COMPETITION_WEIGHTS[eventCode]?.[genderCode] ?? 7.26
            : 7.26;

          return {
            athleteId: athlete.id,
            event: pb.event as never,
            implementWeight: compWeight,
            distance: pb.distance,
            isPersonalBest: true,
            isCompetition: true,
            notes: "Competition PB (self-reported during onboarding)",
            date: new Date(),
          };
        });

      if (pbEntries.length > 0) {
        await prisma.throwLog.createMany({ data: pbEntries });
      }
    }

    return NextResponse.json({
      ...updated,
      dateOfBirth: updated.dateOfBirth?.toISOString() ?? null,
    });
  } catch (err) {
    logger.error("PATCH /api/athlete/profile", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
