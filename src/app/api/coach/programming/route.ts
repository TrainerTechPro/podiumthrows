import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getProgrammedSessions, createProgrammedSession } from "@/lib/data/programming";

/* ─── GET — list programmed sessions in a date range ────────────────────── */

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
    if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "Query params 'start' and 'end' (YYYY-MM-DD) are required." },
        { status: 400 }
      );
    }

    const data = await getProgrammedSessions(coach.id, start, end);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[programming GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* ─── POST — create a programmed session ────────────────────────────────── */

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const { title, scheduledDate, throwsSessionId, tier, groupId, athleteId, parentId, notes } =
      body as Record<string, unknown>;

    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "title is required." }, { status: 400 });
    }
    if (typeof scheduledDate !== "string" || !scheduledDate.trim()) {
      return NextResponse.json({ error: "scheduledDate is required." }, { status: 400 });
    }
    if (typeof throwsSessionId !== "string" || !throwsSessionId.trim()) {
      return NextResponse.json({ error: "throwsSessionId is required." }, { status: 400 });
    }
    if (tier !== "TEAM" && tier !== "GROUP" && tier !== "INDIVIDUAL") {
      return NextResponse.json(
        { error: "tier must be 'TEAM', 'GROUP', or 'INDIVIDUAL'." },
        { status: 400 }
      );
    }

    const data = await createProgrammedSession(coach.id, {
      title: title as string,
      scheduledDate: scheduledDate as string,
      throwsSessionId: throwsSessionId as string,
      tier: tier as "TEAM" | "GROUP" | "INDIVIDUAL",
      groupId: typeof groupId === "string" ? groupId : undefined,
      athleteId: typeof athleteId === "string" ? athleteId : undefined,
      parentId: typeof parentId === "string" ? parentId : undefined,
      notes: typeof notes === "string" ? notes : undefined,
    });

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err) {
    console.error("[programming POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
