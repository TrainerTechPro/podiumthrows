import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAthleteSession } from "@/lib/data/athlete";
import { parseBody } from "@/lib/api-schemas";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

const DraftAnswersSchema = z.object({
  draftAnswers: z.record(z.string(), z.unknown()),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { athlete } = await requireAthleteSession();
    const { id } = await params;

    const parsed = await parseBody(req, DraftAnswersSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { draftAnswers } = parsed;

    // Find the most recent uncompleted assignment
    const assignment = await prisma.questionnaireAssignment.findFirst({
      where: {
        questionnaireId: id,
        athleteId: athlete.id,
        completedAt: null,
      },
      orderBy: { assignedAt: "desc" },
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: "No active assignment found" },
        { status: 404 }
      );
    }

    await prisma.questionnaireAssignment.update({
      where: { id: assignment.id },
      data: { draftAnswers: draftAnswers as Record<string, unknown> as never },
    });

    return NextResponse.json({ success: true, data: { savedAt: new Date().toISOString() } });
  } catch (err) {
    logger.error("PUT /api/athlete/questionnaires/[id]/draft", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to save draft." }, { status: 500 });
  }
}
