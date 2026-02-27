import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();

    const source = await prisma.questionnaire.findFirst({
      where: { id: params.id, coachId: coach.id },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Questionnaire not found" },
        { status: 404 }
      );
    }

    const clone = await prisma.questionnaire.create({
      data: {
        coachId: coach.id,
        title: `${source.title} (Copy)`,
        description: source.description,
        type: source.type,
        questions: source.questions ?? [],
        blocks: source.blocks ?? undefined,
        status: "draft",
        displayMode: source.displayMode,
        welcomeScreen: source.welcomeScreen ?? undefined,
        thankYouScreen: source.thankYouScreen ?? undefined,
        conditionalLogic: source.conditionalLogic ?? undefined,
        scoringEnabled: source.scoringEnabled,
        scoringRules: source.scoringRules ?? undefined,
        allowAnonymous: source.allowAnonymous,
      },
    });

    return NextResponse.json({ questionnaire: clone }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
