import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canAccessAthlete } from "@/lib/authorize";
import { resolveEffectiveSession } from "@/lib/data/programming";
import { logger } from "@/lib/logger";

/* ─── GET — resolve the effective session for an athlete on a date ───────── */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; athleteId: string }> }
) {
  try {
    const { athleteId } = await params;
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });

    // Verify the coach manages this athlete
    const hasAccess = await canAccessAthlete(session.userId, "COACH", athleteId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "You do not manage this athlete" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { success: false, error: "Query param 'date' (YYYY-MM-DD) is required." },
        { status: 400 }
      );
    }

    const resolved = await resolveEffectiveSession(coach.id, athleteId, date);

    if (!resolved) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        effectiveSessionId: resolved.throwsSessionId,
        tier: resolved.tier,
        source: resolved.sourceId,
      },
    });
  } catch (err) {
    logger.error("[programming resolve GET]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
