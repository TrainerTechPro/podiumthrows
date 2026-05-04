import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, AthleteProfileSelfPatchSchema } from "@/lib/api-schemas";
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
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...athlete,
        dateOfBirth: athlete.dateOfBirth?.toISOString() ?? null,
      },
    });
  } catch (err) {
    logger.error("GET /api/athlete/profile", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

/* ─── PATCH — update profile ──────────────────────────────────────────────── */

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBody(req, AthleteProfileSelfPatchSchema);
    if (parsed instanceof NextResponse) return parsed;

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
      trainingHistory,
      lifestyle,
      strengthNumbers,
      competitionPBs,
      completeOnboarding,
    } = parsed;

    // Build the Prisma data object conditionally from provided fields.
    // Unlike the original manual-parse version, Zod has already enforced
    // types and ranges, so we can write straight-through.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    if (firstName !== undefined) data.firstName = firstName.trim();
    if (lastName !== undefined) data.lastName = lastName.trim();
    if (events !== undefined) data.events = events;
    if (gender !== undefined) data.gender = gender;

    if (dateOfBirth !== undefined) {
      data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }
    if (heightCm !== undefined) data.heightCm = heightCm;
    if (weightKg !== undefined) data.weightKg = weightKg;
    if (turnDirection !== undefined) data.turnDirection = turnDirection;
    if (classStanding !== undefined) data.classStanding = classStanding;
    if (gradYear !== undefined) data.gradYear = gradYear;
    if (competitionGoals !== undefined) data.competitionGoals = competitionGoals;
    if (trainingHistory !== undefined) data.trainingHistory = trainingHistory;
    if (lifestyle !== undefined) data.lifestyle = lifestyle;
    if (strengthNumbers !== undefined) data.strengthNumbers = strengthNumbers;

    if (completeOnboarding === true) {
      data.onboardingCompletedAt = new Date();
    }

    // Reject if nothing to update (aside from competitionPBs which create ThrowLogs, not profile updates)
    const hasProfileUpdates = Object.keys(data).length > 0;
    const hasPBs = Array.isArray(competitionPBs) && competitionPBs.length > 0;

    if (!hasProfileUpdates && !hasPBs) {
      return NextResponse.json(
        { success: false, error: "No updatable fields provided." },
        { status: 400 }
      );
    }

    // Get athlete ID for ThrowLog creation
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, gender: true },
    });

    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
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
            trainingHistory: true,
            lifestyle: true,
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
            trainingHistory: true,
            lifestyle: true,
            strengthNumbers: true,
          },
        });

    // Create ThrowLog entries for competition PBs submitted during onboarding
    if (hasPBs && competitionPBs) {
      const resolvedGender = (gender ?? athlete.gender) as Gender;
      const genderCode = GENDER_CODE_MAP[resolvedGender] ?? "M";

      const pbEntries = competitionPBs
        .filter(
          (pb): pb is { event: ThrowEvent; distance: number } =>
            pb.distance != null && pb.distance > 0
        )
        .map((pb) => {
          const eventCode = EVENT_CODE_MAP[pb.event];
          const compWeight = eventCode
            ? (COMPETITION_WEIGHTS[eventCode]?.[genderCode] ?? 7.26)
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
      success: true,
      data: {
        ...updated,
        dateOfBirth: updated?.dateOfBirth?.toISOString() ?? null,
      },
    });
  } catch (err) {
    logger.error("PATCH /api/athlete/profile", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to update profile." },
      { status: 500 }
    );
  }
}
