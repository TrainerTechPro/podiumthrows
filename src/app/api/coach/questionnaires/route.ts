import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession, getCoachQuestionnaires } from "@/lib/data/coach";
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

export async function GET() {
  try {
    const { coach } = await requireCoachSession();
    const questionnaires = await getCoachQuestionnaires(coach.id);
    return NextResponse.json({ questionnaires });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachSession();
    const body = await req.json();

    const { title, description, type, questions, status } = body;

    // Validation
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Valid type is required (ONBOARDING, ASSESSMENT, CHECK_IN, CUSTOM)" },
        { status: 400 }
      );
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Status must be draft or published" }, { status: 400 });
    }

    // Validate questions structure
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
      if (
        (q.type === "single_choice" || q.type === "multiple_choice") &&
        (!Array.isArray(q.options) || q.options.length < 2)
      ) {
        return NextResponse.json(
          { error: `Choice question "${q.text}" must have at least 2 options` },
          { status: 400 }
        );
      }
    }

    const questionnaire = await prisma.questionnaire.create({
      data: {
        coachId: coach.id,
        title: title.trim(),
        description: description?.trim() || null,
        type,
        questions,
        status: status || "draft",
      },
    });

    return NextResponse.json({ questionnaire }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
