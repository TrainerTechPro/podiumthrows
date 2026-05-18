import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, UserTimezoneUpdateSchema } from "@/lib/api-schemas";

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
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBody(req, UserTimezoneUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { timezone } = parsed;

    // Validate the IANA zone
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    } catch {
      return NextResponse.json({ success: false, error: "invalid timezone" }, { status: 400 });
    }

    if (session.role === "COACH") {
      await prisma.coachProfile.updateMany({
        where: { userId: session.userId },
        data: { timezone },
      });
    } else {
      await prisma.athleteProfile.updateMany({
        where: { userId: session.userId },
        data: { timezone },
      });
    }

    return NextResponse.json({ success: true, data: { timezone } });
  } catch (err) {
    logger.error("PATCH /api/user/timezone", { error: err });
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
