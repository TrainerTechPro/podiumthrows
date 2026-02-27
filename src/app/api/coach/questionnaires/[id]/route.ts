import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession, getQuestionnaireById } from "@/lib/data/coach";
import prisma from "@/lib/prisma";

const VALID_TYPES = [
  "ONBOARDING", "ASSESSMENT", "CHECK_IN", "READINESS",
  "COMPETITION", "INJURY", "CUSTOM",
];
const VALID_STATUSES = ["draft", "published", "archived"];

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();
    const questionnaire = await getQuestionnaireById(params.id, coach.id);

    if (!questionnaire) {
      return NextResponse.json({ error: "Questionnaire not found" }, { status: 404 });
    }

    return NextResponse.json({ questionnaire });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();

    const existing = await prisma.questionnaire.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Questionnaire not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      title, description, type, status,
      blocks, questions,
      displayMode, welcomeScreen, thankYouScreen,
      conditionalLogic, scoringEnabled, scoringRules,
      allowAnonymous, expiresAt,
    } = body;

    // Validation
    if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    if (type !== undefined && !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Status must be draft, published, or archived" }, { status: 400 });
    }

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
      where: { id: params.id },
      data: updateData as never,
    });

    return NextResponse.json({ questionnaire });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();

    const existing = await prisma.questionnaire.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Questionnaire not found" }, { status: 404 });
    }

    await prisma.questionnaire.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
