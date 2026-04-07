import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * PATCH /api/user/timezone
 * Body: { timezone: string }
 *
 * Updates the authenticated user's timezone on their AthleteProfile or
 * CoachProfile. Called by the client on each page load if the browser's
 * detected timezone differs from the stored value.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { timezone?: string };
    if (!body.timezone || typeof body.timezone !== "string") {
      return NextResponse.json({ error: "timezone required" }, { status: 400 });
    }

    // Validate the IANA zone
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: body.timezone }).format(new Date());
    } catch {
      return NextResponse.json({ error: "invalid timezone" }, { status: 400 });
    }

    if (session.role === "COACH") {
      await prisma.coachProfile.updateMany({
        where: { userId: session.userId },
        data: { timezone: body.timezone },
      });
    } else {
      await prisma.athleteProfile.updateMany({
        where: { userId: session.userId },
        data: { timezone: body.timezone },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/user/timezone", { error: err });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
