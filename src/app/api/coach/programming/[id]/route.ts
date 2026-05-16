import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateProgrammedSession, deleteProgrammedSession } from "@/lib/data/programming";
import { logger } from "@/lib/logger";
import { parseBody, CoachProgrammingUpdateSchema } from "@/lib/api-schemas";

/* ─── PUT — update a programmed session ─────────────────────────────────── */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const parsed = await parseBody(req, CoachProgrammingUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { title, throwsSessionId, notes, scheduledDate } = parsed;

    const data = await updateProgrammedSession(id, coach.id, {
      ...(typeof title === "string" ? { title } : {}),
      ...(typeof throwsSessionId === "string" ? { throwsSessionId } : {}),
      ...(typeof notes === "string" ? { notes } : {}),
      ...(typeof scheduledDate === "string" ? { scheduledDate } : {}),
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    logger.error("[programming PUT]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/* ─── DELETE — remove a programmed session ───────────────────────────────── */

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    await deleteProgrammedSession(id, coach.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("[programming DELETE]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
