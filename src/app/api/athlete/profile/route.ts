import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
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
    if (!session || !(await canActAsAthlete(session))) {
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
    if (!session || !(await canActAsAthlete(session))) {
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
      turnDirection,
      classStanding,
      gradYear,
      competitionGoals,
      strengthNumbers,
      competitionPBs,
      completeOnboarding,
    } = body as Record<string, unknown>;

    // Validate name fields only when present in the payload
    if (firstName !== undefined) {
      if (typeof firstName !== "string" || firstName.trim().length === 0) {
        return NextResponse.json(
          { error: "First name cannot be empty." },
          { status: 400 }
        );
      }
    }
    if (lastName !== undefined) {
      if (typeof lastName !== "string" || lastName.trim().length === 0) {
        return NextResponse.json(
          { error: "Last name cannot be empty." },
          { status: 400 }
        );
      }
    }

    // Build the Prisma data object conditionally from provided fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    if (typeof firstName === "string")  data.firstName = firstName.trim();
    if (typeof lastName === "string")   data.lastName = lastName.trim();
    if (Array.isArray(events))          data.events = events as never[];
    if (typeof gender === "string")     data.gender = gender as never;

    // dateOfBirth: accept string (set date) or null (clear it)
    if (typeof dateOfBirth === "string" && dateOfBirth) {
      data.dateOfBirth = new Date(dateOfBirth);
    } else if (dateOfBirth === null) {
      data.dateOfBirth = null;
    }

    // Numeric body measurements: accept number (set) or null (clear)
    if (typeof heightCm === "number")   data.heightCm = heightCm;
    else if (heightCm === null)         data.heightCm = null;

    if (typeof weightKg === "number")   data.weightKg = weightKg;
    else if (weightKg === null)         data.weightKg = null;

    // Master profile fields
    if (typeof turnDirection === "string") data.turnDirection = turnDirection;
    else if (turnDirection === null)       data.turnDirection = null;

    if (typeof classStanding === "string") data.classStanding = classStanding;
    else if (classStanding === null)       data.classStanding = null;

    if (typeof gradYear === "number")   data.gradYear = gradYear;
    else if (gradYear === null)         data.gradYear = null;

    // JSON fields: accept object (set) or null (clear)
    if (competitionGoals !== undefined && (typeof competitionGoals === "object" || competitionGoals === null)) {
      data.competitionGoals = competitionGoals;
    }
    if (strengthNumbers !== undefined && (typeof strengthNumbers === "object" || strengthNumbers === null)) {
      data.strengthNumbers = strengthNumbers;
    }

    // completeOnboarding flag
    if (completeOnboarding === true) {
      data.onboardingCompletedAt = new Date();
    }

    // Reject if nothing to update (aside from competitionPBs which create ThrowLogs, not profile updates)
    const hasProfileUpdates = Object.keys(data).length > 0;
    const hasPBs = Array.isArray(competitionPBs) && competitionPBs.length > 0;

    if (!hasProfileUpdates && !hasPBs) {
      return NextResponse.json(
        { error: "No updatable fields provided." },
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

    // Only run the update if there are profile fields to change
    const updated = hasProfileUpdates
      ? await prisma.athleteProfile.update({
          where: { userId: session.userId },
          data,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            events: true,
            gender: true,
            dateOfBirth: true,
            heightCm: true,
            weightKg: true,
            turnDirection: true,
            classStanding: true,
            gradYear: true,
            competitionGoals: true,
            strengthNumbers: true,
          },
        })
      : await prisma.athleteProfile.findUnique({
          where: { userId: session.userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            events: true,
            gender: true,
            dateOfBirth: true,
            heightCm: true,
            weightKg: true,
            turnDirection: true,
            classStanding: true,
            gradYear: true,
            competitionGoals: true,
            strengthNumbers: true,
          },
        });

    // Create ThrowLog entries for competition PBs submitted during onboarding
    if (hasPBs) {
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
      dateOfBirth: updated?.dateOfBirth?.toISOString() ?? null,
    });
  } catch (err) {
    logger.error("PATCH /api/athlete/profile", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
