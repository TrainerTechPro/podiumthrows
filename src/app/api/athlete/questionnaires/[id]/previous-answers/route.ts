import { NextRequest, NextResponse } from "next/server";
import { requireAthleteSession } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";
import { answersArrayToMap } from "@/lib/forms/prefill";
import { logger } from "@/lib/logger";

/**
 * Returns the athlete's most recent submitted answers for this questionnaire,
 * keyed by question/block id, so the client can prefill repeat fills.
 *
 * Returns an empty map (not 404) when there's no prior response — the client
 * treats first-time submissions as a no-op.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { athlete } = await requireAthleteSession();
    const { id: questionnaireId } = await params;

    // Confirm the questionnaire exists and is assigned — same gate as the
    // fill endpoint, so we don't leak which questionnaire IDs exist.
    const assignment = await prisma.questionnaireAssignment.findFirst({
      where: { questionnaireId, athleteId: athlete.id },
      select: { id: true },
    });
    if (!assignment) {
      return NextResponse.json(
        { success: false, error: "Questionnaire not assigned to you" },
        { status: 403 }
      );
    }

    const lastResponse = await prisma.questionnaireResponse.findFirst({
      where: { questionnaireId, athleteId: athlete.id },
      orderBy: { completedAt: "desc" },
      select: { answers: true, completedAt: true },
    });

    if (!lastResponse) {
      return NextResponse.json({
        success: true,
        data: { previousAnswers: {}, completedAt: null },
      });
    }

    const previousAnswers = answersArrayToMap(lastResponse.answers);

    return NextResponse.json({
      success: true,
      data: {
        previousAnswers,
        completedAt: lastResponse.completedAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error("GET /api/athlete/questionnaires/[id]/previous-answers", {
      context: "api",
      error: err,
    });
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}
