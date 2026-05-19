import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, CoachSessionNoteSchema } from "@/lib/api-schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const parsed = await parseBody(req, CoachSessionNoteSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { content } = parsed;

    const trainingSession = await prisma.trainingSession.findFirst({
      where: { id: sessionId, athlete: { coachId: coach.id } },
      select: { id: true, athleteId: true },
    });
    if (!trainingSession) {
      return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 });
    }

    await prisma.trainingSession.update({
      where: { id: sessionId },
      data: { coachNotes: content.trim() },
    });

    revalidateTag(`athlete-${trainingSession.athleteId}`);
    revalidateTag(`coach-${coach.id}`);

    return NextResponse.json(
      {
        success: true,
        data: { sessionId, content: content.trim(), savedAt: new Date().toISOString() },
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("POST /api/coach/sessions/[sessionId]/notes", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Couldn’t save note." }, { status: 500 });
  }
}
