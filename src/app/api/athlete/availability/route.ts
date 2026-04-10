import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  getAthleteAvailability,
  createAvailabilityBlock,
} from "@/lib/data/availability";

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
    return NextResponse.json({ success: false, error: "Failed to fetch availability." }, { status: 500 });
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

    const body = await req.json().catch(() => ({}));
    const { dayOfWeek, startTime, endTime, type, label, notes } =
      body as Record<string, unknown>;

    if (typeof dayOfWeek !== "number") {
      return NextResponse.json({ success: false, error: "dayOfWeek is required." }, { status: 400 });
    }
    if (typeof startTime !== "string" || !startTime) {
      return NextResponse.json({ success: false, error: "startTime is required." }, { status: 400 });
    }
    if (typeof endTime !== "string" || !endTime) {
      return NextResponse.json({ success: false, error: "endTime is required." }, { status: 400 });
    }
    if (typeof type !== "string" || !type) {
      return NextResponse.json({ success: false, error: "type is required." }, { status: 400 });
    }

    const block = await createAvailabilityBlock(athlete.id, {
      dayOfWeek,
      startTime,
      endTime,
      type,
      label: typeof label === "string" ? label : null,
      notes: typeof notes === "string" ? notes : null,
    });

    return NextResponse.json({ success: true, data: block }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/athlete/availability", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Failed to create availability block.";
    const status = message === "Not found" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
