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
    const {
      athleteId,
      date,
      selfFeeling,
      sleepHours,
      sleepQuality,
      energy,
      sorenessGeneral,
      sorenessShoulder,
      sorenessBack,
      sorenessHip,
      sorenessKnee,
      sorenessElbow,
      sorenessWrist,
      lightImplFeeling,
      heavyImplFeeling,
      notes,
      source, // "ATHLETE" | "COACH" — who is submitting this check-in
    } = body;

    if (!athleteId || !date || !selfFeeling) {
      return NextResponse.json({ success: false, error: "athleteId, date, and selfFeeling are required" }, { status: 400 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const checkinSource: string = source === "COACH" ? "COACH" : "ATHLETE";

    const checkin = await prisma.throwsCheckIn.upsert({
      where: { athleteId_date: { athleteId, date } },
      create: {
        athleteId,
        date,
        selfFeeling,
        sleepHours: sleepHours ?? null,
        sleepQuality: sleepQuality ?? null,
        energy: energy ?? null,
        sorenessGeneral: sorenessGeneral ?? null,
        sorenessShoulder: sorenessShoulder ?? null,
        sorenessBack: sorenessBack ?? null,
        sorenessHip: sorenessHip ?? null,
        sorenessKnee: sorenessKnee ?? null,
        sorenessElbow: sorenessElbow ?? null,
        sorenessWrist: sorenessWrist ?? null,
        lightImplFeeling: lightImplFeeling ?? null,
        heavyImplFeeling: heavyImplFeeling ?? null,
        notes: notes ?? null,
        source: checkinSource,
      },
      update: {
        selfFeeling,
        sleepHours: sleepHours ?? null,
        sleepQuality: sleepQuality ?? null,
        energy: energy ?? null,
        sorenessGeneral: sorenessGeneral ?? null,
        sorenessShoulder: sorenessShoulder ?? null,
        sorenessBack: sorenessBack ?? null,
        sorenessHip: sorenessHip ?? null,
        sorenessKnee: sorenessKnee ?? null,
        sorenessElbow: sorenessElbow ?? null,
        sorenessWrist: sorenessWrist ?? null,
        lightImplFeeling: lightImplFeeling ?? null,
        heavyImplFeeling: heavyImplFeeling ?? null,
        notes: notes ?? null,
        source: checkinSource,
      },
    });

    return NextResponse.json({ success: true, data: checkin });
  } catch (error) {
    logger.error("Check-in error", { context: "throws/checkins", error: error });
    return NextResponse.json({ success: false, error: "Failed to save check-in" }, { status: 500 });
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
    const days = parseInt(searchParams.get("days") || "30");

    if (!athleteId) {
      return NextResponse.json({ success: false, error: "athleteId is required" }, { status: 400 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split("T")[0];

    const checkins = await prisma.throwsCheckIn.findMany({
      where: { athleteId, date: { gte: sinceStr } },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ success: true, data: checkins });
  } catch (error) {
    logger.error("Get check-ins error", { context: "throws/checkins", error: error });
    return NextResponse.json({ success: false, error: "Failed to fetch check-ins" }, { status: 500 });
  }
}
