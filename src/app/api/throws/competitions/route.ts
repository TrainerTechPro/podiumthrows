import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, CompetitionCreateSchema, CompetitionUpdateSchema } from "@/lib/api-schemas";
import { EventType } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const parsed = await parseBody(request, CompetitionCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const {
      athleteId,
      name,
      date,
      event,
      priority,
      result,
      notes,
      implementWeightKg,
      placeFinish,
      meetStatus,
      venueType,
      weather,
      windMps,
      format,
      madeFinals,
    } = parsed;

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const competition = await prisma.throwsCompetition.create({
      data: {
        athleteId,
        name,
        date,
        event: event as EventType,
        priority: priority || "B",
        result: result ?? null,
        notes: notes ?? null,
        implementWeightKg: implementWeightKg ?? null,
        placeFinish: placeFinish ?? null,
        meetStatus: meetStatus ?? "COMPLETED",
        venueType: venueType ?? null,
        weather: weather ?? null,
        windMps: windMps ?? null,
        format: format ?? "THREE_PLUS_THREE",
        madeFinals: madeFinals ?? null,
      },
    });

    return NextResponse.json({ success: true, data: competition });
  } catch (error) {
    logger.error("Create competition error", { context: "throws/competitions", error: error });
    return NextResponse.json({ success: false, error: "Failed to create competition" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const parsed = await parseBody(request, CompetitionUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { id, result, notes, resultBy } = parsed;

    // Verify the caller has access to this competition's athlete
    const existing = await prisma.throwsCompetition.findUnique({
      where: { id },
      select: { athleteId: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Competition not found" }, { status: 404 });
    }
    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", existing.athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const competition = await prisma.throwsCompetition.update({
      where: { id },
      data: {
        ...(result !== undefined && { result: result ?? null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(resultBy !== undefined && { resultBy }),
      },
    });

    return NextResponse.json({ success: true, data: competition });
  } catch (error) {
    logger.error("Update competition error", { context: "throws/competitions", error: error });
    return NextResponse.json({ success: false, error: "Failed to update competition" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");

    if (!athleteId) {
      return NextResponse.json({ success: false, error: "athleteId is required" }, { status: 400 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const competitions = await prisma.throwsCompetition.findMany({
      where: { athleteId },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ success: true, data: competitions });
  } catch (error) {
    logger.error("Get competitions error", { context: "throws/competitions", error: error });
    return NextResponse.json({ success: false, error: "Failed to fetch competitions" }, { status: 500 });
  }
}
