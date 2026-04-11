import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession, getQuestionnaireById } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { parseBody, QuestionnaireUpdateSchema } from "@/lib/api-schemas";

// Validation for type/status now lives in QuestionnaireUpdateSchema.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { coach } = await requireCoachSession();
    const { id } = await params;
    const questionnaire = await getQuestionnaireById(id, coach.id);

    if (!questionnaire) {
      return NextResponse.json({ success: false, error: "Questionnaire not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { questionnaire } });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { coach } = await requireCoachSession();
    const { id } = await params;

    const existing = await prisma.questionnaire.findFirst({
      where: { id, coachId: coach.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Questionnaire not found" }, { status: 404 });
    }

    const parsed = await parseBody(req, QuestionnaireUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const {
      title, description, type, status,
      blocks, questions,
      displayMode, welcomeScreen, thankYouScreen,
      conditionalLogic, scoringEnabled, scoringRules,
      allowAnonymous, expiresAt,
    } = parsed;

    // Build update payload — only include fields that were sent
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (type !== undefined) updateData.type = type;
    if (status !== undefined) updateData.status = status;
    if (questions !== undefined) updateData.questions = questions;
    if (blocks !== undefined) updateData.blocks = blocks;
    if (displayMode !== undefined) updateData.displayMode = displayMode;
    if (welcomeScreen !== undefined) updateData.welcomeScreen = welcomeScreen;
    if (thankYouScreen !== undefined) updateData.thankYouScreen = thankYouScreen;
    if (conditionalLogic !== undefined) updateData.conditionalLogic = conditionalLogic;
    if (scoringEnabled !== undefined) updateData.scoringEnabled = scoringEnabled;
    if (scoringRules !== undefined) updateData.scoringRules = scoringRules;
    if (allowAnonymous !== undefined) updateData.allowAnonymous = allowAnonymous;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

    // Handle archive: deactivate when archiving
    if (status === "archived") {
      updateData.isActive = false;
    } else if (status === "published" || status === "draft") {
      updateData.isActive = true;
    }

    const questionnaire = await prisma.questionnaire.update({
      where: { id: id },
      data: updateData as never,
    });

    return NextResponse.json({ success: true, data: { questionnaire } });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { coach } = await requireCoachSession();
    const { id } = await params;

    const existing = await prisma.questionnaire.findFirst({
      where: { id, coachId: coach.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Questionnaire not found" }, { status: 404 });
    }

    await prisma.questionnaire.delete({ where: { id: id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}
