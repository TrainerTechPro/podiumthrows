/**
 * POST /api/athlete/self-program
 *
 * Creates a new draft SelfProgramConfig for the logged-in athlete.
 * Deletes any existing draft before creating the new one.
 */
import { NextResponse } from "next/server";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { canAccessSelfProgram } from "@/lib/authorize";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canAccess = await canAccessSelfProgram(session.userId);
    if (!canAccess) {
      return NextResponse.json(
        { error: "Self-programming not enabled for this account" },
        { status: 403 },
      );
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // Delete any existing draft for this athlete
    await prisma.selfProgramConfig.deleteMany({
      where: { athleteProfileId: athlete.id, isDraft: true },
    });

    // Create new draft with minimal defaults
    const config = await prisma.selfProgramConfig.create({
      data: {
        athleteProfileId: athlete.id,
        isDraft: true,
        isActive: true,
        generationCount: 0,
        currentPhaseIndex: 0,
        // Wizard defaults (will be overwritten as the user fills in the wizard)
        programType: "THROWS_AND_LIFTING",
        event: "SHOT_PUT",
        gender: "MALE",
        yearsExperience: 1,
        competitionLevel: "COLLEGIATE",
        currentPR: 0,
        goalDistance: 0,
        availableImplements: [],
        daysPerWeek: 4,
        sessionsPerDay: 1,
        preferredDays: [],
        startDate: new Date(),
        primaryGoal: "DISTANCE",
        generationMode: "GUIDED",
        usedExistingTyping: false,
      },
      select: { id: true },
    });

    return NextResponse.json({ id: config.id }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/athlete/self-program", { context: "api", error: err });
    return NextResponse.json(
      { error: "Failed to create self-program config." },
      { status: 500 },
    );
  }
}
