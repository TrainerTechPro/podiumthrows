import { NextRequest, NextResponse } from "next/server";
import { requireAthleteSession, getQuestionnaireForFill } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { athlete } = await requireAthleteSession();
    const questionnaire = await getQuestionnaireForFill(params.id, athlete.id);

    if (!questionnaire) {
      return NextResponse.json({ error: "Questionnaire not found or not assigned" }, { status: 404 });
    }

    return NextResponse.json({ questionnaire });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { athlete } = await requireAthleteSession();

    // Verify assignment
    const assignment = await prisma.questionnaireAssignment.findUnique({
      where: {
        questionnaireId_athleteId: {
          questionnaireId: params.id,
          athleteId: athlete.id,
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Questionnaire not assigned to you" },
        { status: 403 }
      );
    }

    if (assignment.completedAt) {
      return NextResponse.json(
        { error: "You have already completed this questionnaire" },
        { status: 400 }
      );
    }

    // Get questionnaire for validation
    const questionnaire = await prisma.questionnaire.findUnique({
      where: { id: params.id },
      select: { id: true, questions: true, status: true },
    });

    if (!questionnaire || questionnaire.status !== "published") {
      return NextResponse.json(
        { error: "Questionnaire not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { answers } = body;

    if (!Array.isArray(answers)) {
      return NextResponse.json(
        { error: "Answers must be an array" },
        { status: 400 }
      );
    }

    // Validate required questions are answered
    const questions = questionnaire.questions as Array<{
      id: string;
      text: string;
      type: string;
      required?: boolean;
    }>;

    const answerMap = new Map(
      answers.map((a: { questionId: string }) => [a.questionId, a])
    );

    for (const q of questions) {
      if (q.required) {
        const answer = answerMap.get(q.id) as { answer?: unknown } | undefined;
        if (!answer || answer.answer === undefined || answer.answer === null || answer.answer === "") {
          return NextResponse.json(
            { error: `Required question "${q.text}" must be answered` },
            { status: 400 }
          );
        }
      }
    }

    // Ensure answers include question text for historical record
    const enrichedAnswers = answers.map((a: { questionId: string; answer: unknown }) => {
      const question = questions.find((q) => q.id === a.questionId);
      return {
        questionId: a.questionId,
        questionText: question?.text ?? "Unknown question",
        answer: a.answer,
      };
    });

    const now = new Date();

    // Create response and mark assignment complete in a transaction
    const [response] = await prisma.$transaction([
      prisma.questionnaireResponse.create({
        data: {
          questionnaireId: params.id,
          athleteId: athlete.id,
          answers: enrichedAnswers as unknown as never,
          completedAt: now,
        },
      }),
      prisma.questionnaireAssignment.update({
        where: { id: assignment.id },
        data: { completedAt: now },
      }),
    ]);

    return NextResponse.json({ response }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
