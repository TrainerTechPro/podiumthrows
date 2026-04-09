import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishSession } from "@/lib/data/programming";
import { logger } from "@/lib/logger";

/* ─── POST — publish a programmed session ───────────────────────────────── */

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });

    const result = await publishSession(id, coach.id);

    return NextResponse.json({
      success: true,
      data: {
        assignmentsCreated: result.created,
        assignmentsUpdated: result.updated,
      },
    });
  } catch (err) {
    logger.error("[programming publish POST]", { context: "api", error: err });
    if (err instanceof Error && err.message.includes("not found")) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
