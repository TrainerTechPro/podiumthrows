import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  updateAvailabilityBlock,
  deleteAvailabilityBlock,
} from "@/lib/data/availability";

/* ─── PATCH — update a single availability block ─────────────────────────── */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const block = await updateAvailabilityBlock(id, athlete.id, body);
    return NextResponse.json({ success: true, data: block });
  } catch (err) {
    logger.error("PATCH /api/athlete/availability/[id]", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Couldn’t update availability block.";
    const status = message.includes("not found") || message === "Not found" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

/* ─── DELETE — delete a single availability block ────────────────────────── */

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    await deleteAvailabilityBlock(id, athlete.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/athlete/availability/[id]", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Couldn’t delete availability block.";
    const status = message.includes("not found") || message === "Not found" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
