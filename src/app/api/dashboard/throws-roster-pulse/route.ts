/**
 * /api/dashboard/throws-roster-pulse
 *
 * GET — Enhanced per-athlete throws data for the coach dashboard roster table.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchCoachByUserId } from "@/lib/data/coach";
import { getThrowsRosterPulse } from "@/lib/data/throws";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coaches only" }, { status: 403 });
    }

    const coach = await fetchCoachByUserId(currentUser.userId);
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
    }

    const data = await getThrowsRosterPulse(coach.id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error("Throws roster pulse error", { context: "dashboard/throws-roster-pulse", error });
    return NextResponse.json({ success: false, error: "Failed to fetch roster pulse" }, { status: 500 });
  }
}
