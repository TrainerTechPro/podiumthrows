import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

// GET /api/throws/testing?athleteId=...
// Returns the performanceBenchmarks JSON from AthleteProfile
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const athleteIdParam = searchParams.get("athleteId");

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      include: { athleteProfile: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const athleteId = user.role === "ATHLETE" && user.athleteProfile
      ? user.athleteProfile.id
      : athleteIdParam;

    if (!athleteId) {
      return NextResponse.json({ success: false, error: "athleteId required" }, { status: 400 });
    }

    if (user.role !== "ATHLETE" && !(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { performanceBenchmarks: true },
    });

    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    let benchmarks = {};
    try { benchmarks = JSON.parse(athlete.performanceBenchmarks || "{}"); } catch { /* ignore */ }

    return NextResponse.json({ success: true, data: benchmarks });
  } catch (error) {
    logger.error("GET /api/throws/testing error", { context: "throws/testing", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/throws/testing — merge-update performanceBenchmarks for an athlete
export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { athleteId: bodyAthleteId, benchmarks } = body;

    if (!benchmarks || typeof benchmarks !== "object") {
      return NextResponse.json({ success: false, error: "benchmarks object required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      include: { athleteProfile: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const athleteId = user.role === "COACH" && bodyAthleteId
      ? bodyAthleteId
      : user.athleteProfile?.id;

    if (!athleteId) {
      return NextResponse.json({ success: false, error: "Cannot determine athlete" }, { status: 400 });
    }

    if (user.role !== "ATHLETE" && !(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Merge with existing benchmarks
    const existing = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { performanceBenchmarks: true },
    });

    let current = {};
    try { current = JSON.parse(existing?.performanceBenchmarks || "{}"); } catch { /* ignore */ }

    const merged = { ...current, ...benchmarks };

    await prisma.athleteProfile.update({
      where: { id: athleteId },
      data: { performanceBenchmarks: JSON.stringify(merged) },
    });

    return NextResponse.json({ success: true, data: merged });
  } catch (error) {
    logger.error("PATCH /api/throws/testing error", { context: "throws/testing", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
