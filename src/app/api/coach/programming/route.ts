import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getProgrammedSessions, createProgrammedSession } from "@/lib/data/programming";
import { logger } from "@/lib/logger";
import { parseBody, CoachProgrammingCreateSchema } from "@/lib/api-schemas";

/* ─── GET — list programmed sessions in a date range ────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach)
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { success: false, error: "Query params 'start' and 'end' (YYYY-MM-DD) are required." },
        { status: 400 }
      );
    }

    const data = await getProgrammedSessions(coach.id, start, end);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    logger.error("[programming GET]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/* ─── POST — create a programmed session ────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach)
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });

    const parsed = await parseBody(req, CoachProgrammingCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { title, scheduledDate, throwsSessionId, tier, groupId, athleteId, parentId, notes } =
      parsed;

    const data = await createProgrammedSession(coach.id, {
      title,
      scheduledDate,
      throwsSessionId,
      tier,
      groupId: groupId ?? undefined,
      athleteId: athleteId ?? undefined,
      parentId: parentId ?? undefined,
      notes: notes ?? undefined,
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    logger.error("[programming POST]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
