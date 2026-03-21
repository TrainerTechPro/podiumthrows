import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { resolveEffectiveSession } from "@/lib/data/programming";

/* ─── GET — resolve the effective session for an athlete on a date ───────── */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; athleteId: string } }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { error: "Query param 'date' (YYYY-MM-DD) is required." },
        { status: 400 }
      );
    }

    const resolved = await resolveEffectiveSession(coach.id, params.athleteId, date);

    if (!resolved) {
      return NextResponse.json({ ok: true, data: null });
    }

    return NextResponse.json({
      ok: true,
      data: {
        effectiveSessionId: resolved.throwsSessionId,
        tier: resolved.tier,
        source: resolved.sourceId,
      },
    });
  } catch (err) {
    console.error("[programming resolve GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
