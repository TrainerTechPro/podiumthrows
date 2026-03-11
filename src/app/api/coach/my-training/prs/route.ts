import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const event = searchParams.get("event");

    const where: Record<string, unknown> = { coachId: coach.id };
    if (event) where.event = event;

    const prs = await prisma.coachPR.findMany({
      where,
      orderBy: [{ event: "asc" }, { distance: "desc" }],
    });

    return NextResponse.json({ ok: true, data: prs });
  } catch (err) {
    console.error("[GET /api/coach/my-training/prs]", err);
    return NextResponse.json({ error: "Failed to fetch PRs" }, { status: 500 });
  }
}
