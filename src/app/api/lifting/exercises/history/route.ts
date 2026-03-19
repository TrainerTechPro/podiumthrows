/**
 * GET /api/lifting/exercises/history
 *
 * Returns the last N workout logs for a specific exercise name.
 * Used to show progressive overload history in the workout logger.
 *
 * Query params:
 *   - name  (required) — exercise name to look up
 *   - limit (optional) — max results, default 10, capped at 50
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "COACH") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    const limitParam = parseInt(searchParams.get("limit") || "10", 10);
    const limit = Math.min(Math.max(isNaN(limitParam) ? 10 : limitParam, 1), 50);

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Exercise name is required" },
        { status: 400 },
      );
    }

    const logs = await prisma.liftingExerciseLog.findMany({
      where: {
        exerciseName: name,
        workoutLog: { coachId: coach.id },
        isSkipped: false,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        workoutLog: {
          select: {
            weekNumber: true,
            workoutNumber: true,
            date: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    logger.error("Exercise history lookup error", {
      context: "lifting/exercises/history",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to load exercise history" },
      { status: 500 },
    );
  }
}
