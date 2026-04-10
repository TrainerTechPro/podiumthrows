import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
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

    const body = await req.json().catch(() => ({}));
    const { date, startTime, endTime, type, reason } = body as Record<string, unknown>;

    if (typeof date !== "string" || !date) {
      return NextResponse.json({ success: false, error: "date is required." }, { status: 400 });
    }
    if (typeof type !== "string" || !type) {
      return NextResponse.json({ success: false, error: "type is required." }, { status: 400 });
    }

    const override = await createAvailabilityOverride(athlete.id, {
      date,
      startTime: typeof startTime === "string" ? startTime : null,
      endTime: typeof endTime === "string" ? endTime : null,
      type,
      reason: typeof reason === "string" ? reason : null,
    });

    return NextResponse.json({ success: true, data: override }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/athlete/availability/overrides", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Failed to create availability override.";
    const status = message === "Not found" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
