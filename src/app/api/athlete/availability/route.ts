import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, AvailabilityBlockSchema } from "@/lib/api-schemas";
import { getAthleteAvailability, createAvailabilityBlock } from "@/lib/data/availability";

/* ─── GET — fetch current athlete's blocks + overrides ───────────────────── */

export async function GET() {
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

    const data = await getAthleteAvailability(athlete.id);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    logger.error("GET /api/athlete/availability", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to fetch availability." },
      { status: 500 }
    );
  }
}

/* ─── POST — create a new recurring availability block ───────────────────── */

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

    const parsed = await parseBody(req, AvailabilityBlockSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { dayOfWeek, startTime, endTime, type, label, notes } = parsed;

    const block = await createAvailabilityBlock(athlete.id, {
      dayOfWeek,
      startTime,
      endTime,
      type,
      label: label ?? null,
      notes: notes ?? null,
    });

    return NextResponse.json({ success: true, data: block }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/athlete/availability", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Failed to create availability block.";
    const status = message === "Not found" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
