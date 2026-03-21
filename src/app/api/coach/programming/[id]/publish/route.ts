import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishSession } from "@/lib/data/programming";

/* ─── POST — publish a programmed session ───────────────────────────────── */

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
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

    const result = await publishSession(params.id, coach.id);

    return NextResponse.json({
      ok: true,
      assignmentsCreated: result.created,
      assignmentsUpdated: result.updated,
    });
  } catch (err) {
    console.error("[programming publish POST]", err);
    if (err instanceof Error && err.message.includes("not found")) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
