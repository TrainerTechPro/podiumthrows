import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

/** PATCH — coach updates athlete bio fields (gender, sport, height, weight, dateOfBirth) */
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { athleteId, gender, sport, height, weight, dateOfBirth } = body;

    if (!athleteId) {
      return NextResponse.json({ success: false, error: "athleteId is required" }, { status: 400 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const athlete = await prisma.athleteProfile.update({
      where: { id: athleteId },
      data: {
        ...(gender !== undefined && { gender }),
        ...(sport !== undefined && { sport }),
        ...(height !== undefined && { height: height !== "" && height !== null ? parseFloat(String(height)) : null }),
        ...(weight !== undefined && { weight: weight !== "" && weight !== null ? parseFloat(String(weight)) : null }),
        ...(dateOfBirth !== undefined && { dateOfBirth }),
      },
    });

    return NextResponse.json({ success: true, data: athlete });
  } catch (error) {
    logger.error("Athlete bio update error", { context: "throws/athlete-bio", error: error });
    return NextResponse.json({ success: false, error: "Failed to update athlete bio" }, { status: 500 });
  }
}
