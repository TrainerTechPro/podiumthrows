import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { athleteId, name, date, event, priority, result, notes } = body;

    if (!athleteId || !name || !date || !event) {
      return NextResponse.json({ success: false, error: "athleteId, name, date, and event are required" }, { status: 400 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const competition = await prisma.throwsCompetition.create({
      data: {
        athleteId,
        name,
        date,
        event,
        priority: priority || "B",
        result: result ?? null,
        notes: notes ?? null,
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

    const body = await request.json();
    const { id, result, notes, resultBy } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

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
        ...(result !== undefined && { result: result === "" ? null : parseFloat(result) }),
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
