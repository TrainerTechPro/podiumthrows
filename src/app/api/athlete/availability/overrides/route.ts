import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, AvailabilityOverrideSchema } from "@/lib/api-schemas";
import { createAvailabilityOverride } from "@/lib/data/availability";

/* ─── POST — create a date-specific availability override ────────────────── */

export async function POST(req: NextRequest) {
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
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const parsed = await parseBody(req, AvailabilityOverrideSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { date, startTime, endTime, type, reason } = parsed;

    const override = await createAvailabilityOverride(athlete.id, {
      date,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
      type,
      reason: reason ?? null,
    });

    return NextResponse.json({ success: true, data: override }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/athlete/availability/overrides", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Failed to create availability override.";
    const status = message === "Not found" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
