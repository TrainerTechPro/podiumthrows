import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createOverride } from "@/lib/data/programming";
import { logger } from "@/lib/logger";
import { parseBody, CoachProgrammingOverrideSchema } from "@/lib/api-schemas";

/* ─── POST — create a tier override for a programmed session ─────────────── */

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    if (!coach)
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });

    const parsed = await parseBody(req, CoachProgrammingOverrideSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { throwsSessionId, tier, groupId, athleteId } = parsed;

    const data = await createOverride(id, coach.id, {
      throwsSessionId,
      tier,
      groupId: groupId ?? undefined,
      athleteId: athleteId ?? undefined,
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    logger.error("[programming override POST]", { context: "api", error: err });
    if (err instanceof Error && err.message.includes("not found")) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
