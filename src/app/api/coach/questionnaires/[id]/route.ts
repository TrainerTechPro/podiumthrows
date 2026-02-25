import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession, getQuestionnaireById } from "@/lib/data/coach";
import prisma from "@/lib/prisma";

const VALID_TYPES = ["ONBOARDING", "ASSESSMENT", "CHECK_IN", "CUSTOM"];
const VALID_STATUSES = ["draft", "published"];
const VALID_QUESTION_TYPES = [
  "short_text",
  "long_text",
  "number",
  "scale_1_5",
  "scale_1_10",
  "single_choice",
  "multiple_choice",
  "yes_no",
];

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

    // Verify ownership
    const existing = await prisma.questionnaire.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Questionnaire not found" }, { status: 404 });
    }

    const body = await req.json();
    const { title, description, type, questions, status } = body;

    // Validation
    if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    if (type !== undefined && !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Status must be draft or published" }, { status: 400 });
    }

    // Validate questions if provided
    if (questions !== undefined) {
      if (!Array.isArray(questions) || questions.length === 0) {
        return NextResponse.json(
          { error: "At least one question is required" },
          { status: 400 }
        );
      }
      for (const q of questions) {
        if (!q.id || !q.text || !q.type) {
          return NextResponse.json(
            { error: "Each question must have id, text, and type" },
            { status: 400 }
          );
        }
        if (!VALID_QUESTION_TYPES.includes(q.type)) {
          return NextResponse.json(
            { error: `Invalid question type: ${q.type}` },
            { status: 400 }
          );
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (type !== undefined) updateData.type = type;
    if (questions !== undefined) updateData.questions = questions;
    if (status !== undefined) updateData.status = status;

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

    // Verify ownership
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
