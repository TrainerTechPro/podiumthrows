import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/athletes
 *
 * Dual-role endpoint:
 *   Coach  → returns all athletes on their roster
 *   Athlete → returns their own profile (as a single-element array)
 *
 * Response shape (normalized for frontend consumers):
 *   { success: true, data: { id, user: { firstName, lastName }, profilePictureUrl }[] }
 *
 * Note: firstName/lastName live on AthleteProfile (not User), but pages
 * access them as `athlete.user.firstName` — we normalize the shape here.
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    if (currentUser.role === "COACH") {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: currentUser.userId },
        select: { id: true },
      });

      if (!coach) {
        return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
      }

      const athletes = await prisma.athleteProfile.findMany({
        where: { coachId: coach.id },
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      });

      const data = athletes.map((a) => ({
        id: a.id,
        profilePictureUrl: a.avatarUrl,
        user: { firstName: a.firstName, lastName: a.lastName },
      }));

      return NextResponse.json({ success: true, data });
    }

    // Athlete role — return own profile as single-element array
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });

    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete profile not found" }, { status: 404 });
    }

    const data = [
      {
        id: athlete.id,
        profilePictureUrl: athlete.avatarUrl,
        user: { firstName: athlete.firstName, lastName: athlete.lastName },
      },
    ];

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error("GET /api/athletes error", { context: "athletes", error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
