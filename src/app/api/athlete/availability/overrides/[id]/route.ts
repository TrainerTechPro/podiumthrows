import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { deleteAvailabilityOverride } from "@/lib/data/availability";

/* ─── DELETE — remove a date-specific availability override ──────────────── */

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    await deleteAvailabilityOverride(id, athlete.id);
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (err) {
    logger.error("DELETE /api/athlete/availability/overrides/[id]", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Failed to delete availability override.";
    const status = message.includes("not found") || message === "Not found" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
