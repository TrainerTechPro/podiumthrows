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
    const { athleteId, startDate, exercises, event } = body;

    if (!athleteId || !startDate || !exercises || !event) {
      return NextResponse.json({ success: false, error: "athleteId, startDate, exercises, and event are required" }, { status: 400 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Close any existing open complex for this athlete
    await prisma.throwsComplex.updateMany({
      where: { athleteId, endDate: null },
      data: { endDate: startDate },
    });

    const complex = await prisma.throwsComplex.create({
      data: {
        athleteId,
        startDate,
        exercises: JSON.stringify(exercises),
        event,
      },
    });

    return NextResponse.json({ success: true, data: complex });
  } catch (error) {
    logger.error("Create complex error", { context: "throws/complexes", error: error });
    return NextResponse.json({ success: false, error: "Failed to create complex" }, { status: 500 });
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

    const complexes = await prisma.throwsComplex.findMany({
      where: { athleteId },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json({ success: true, data: complexes });
  } catch (error) {
    logger.error("Get complexes error", { context: "throws/complexes", error: error });
    return NextResponse.json({ success: false, error: "Failed to fetch complexes" }, { status: 500 });
  }
}
