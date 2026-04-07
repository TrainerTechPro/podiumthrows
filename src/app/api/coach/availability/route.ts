import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getTeamAvailability } from "@/lib/data/availability";

/* ─── GET — team-wide availability summary ───────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId") ?? undefined;
    const excludeInjured = searchParams.get("excludeInjured") === "true";

    const data = await getTeamAvailability(coach.id, groupId, excludeInjured);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    logger.error("GET /api/coach/availability", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch team availability." }, { status: 500 });
  }
}
