/**
 * POST /api/athlete/streak/freeze
 *
 * Consumes one weekly streak freeze for the authenticated athlete. Marks today
 * as covered without incrementing the streak — the gentle "rest day" path.
 *
 * Errors are domain-typed via the `reason` field:
 *   - "no-streak"               — athlete has no active streak to freeze
 *   - "already-frozen-today"    — they tapped the snowflake earlier today
 *   - "no-freezes-available"    — weekly quota exhausted
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { applyFreezeForToday } from "@/lib/athlete/streak-engine";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json(
        { success: false, error: "Athlete profile not found" },
        { status: 404 }
      );
    }

    const result = await applyFreezeForToday(athlete.id);
    if (!result.ok) {
      const status = result.reason === "no-freezes-available" ? 409 : 400;
      return NextResponse.json(
        { success: false, error: humanReason(result.reason), reason: result.reason },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        freezesAvailable: result.freezesAvailable,
        freezesResetAt: result.freezesResetAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error("POST /api/athlete/streak/freeze", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Couldn’t apply freeze." }, { status: 500 });
  }
}

function humanReason(
  reason: "no-streak" | "already-frozen-today" | "no-freezes-available"
): string {
  switch (reason) {
    case "no-streak":
      return "You don't have an active streak to freeze yet — log a session first.";
    case "already-frozen-today":
      return "Today is already frozen.";
    case "no-freezes-available":
      return "You've used your freeze for the week. Resets Sunday.";
  }
}
