import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// GET /api/coach/my-athlete-profile — return the coach's own athlete profile (if dual-role)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Check if this coach user also has an athlete profile
    const athleteProfile = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        events: true,
      },
    });

    // Return null data if no athlete profile — the page handles this gracefully
    return NextResponse.json({
      success: true,
      data: athleteProfile
        ? {
            id: athleteProfile.id,
            sport: athleteProfile.events.length > 0 ? athleteProfile.events[0] : null,
          }
        : null,
    });
  } catch (error) {
    logger.error("GET /api/coach/my-athlete-profile error", { context: "coach/my-athlete-profile", error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
