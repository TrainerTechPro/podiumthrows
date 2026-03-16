import { NextRequest, NextResponse } from "next/server";
import { requireAthleteSession, getQuestionnaireForFill } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { calculateFormScores } from "@/lib/forms/scoring-engine";
import type { FormBlock, ScoringConfig } from "@/lib/forms/types";
import { parseBody, QuestionnaireSubmissionSchema } from "@/lib/api-schemas";

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

    // Verify assignment (find the most recent uncompleted)
    const assignment = await prisma.questionnaireAssignment.findFirst({
      where: {
        questionnaireId: params.id,
        athleteId: athlete.id,
        completedAt: null,
      },
      orderBy: { assignedAt: "desc" },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Questionnaire not assigned to you or already completed" },
        { status: 403 }
      );
    }

    // Get questionnaire for validation — include blocks and scoring fields
    const questionnaire = await prisma.questionnaire.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        questions: true,
        blocks: true,
        status: true,
        scoringEnabled: true,
        scoringRules: true,
      },
    });

    if (!questionnaire || questionnaire.status !== "published") {
      return NextResponse.json(
        { error: "Questionnaire not found" },
        { status: 404 }
      );
    }

    const parsed = await parseBody(req, QuestionnaireSubmissionSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { answers, durationSeconds } = parsed;

    const blocks = questionnaire.blocks as FormBlock[] | null;
    const hasBlocks = blocks && blocks.length > 0;

    // ── Block-based form submission ───────────────────────────────────────
    if (hasBlocks) {
      if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
        return NextResponse.json(
          { error: "Answers must be a Record<blockId, value>" },
          { status: 400 }
        );
      }

      const answersRecord = answers as Record<string, unknown>;

      // Validate required blocks (skip layout-only types)
      const LAYOUT_TYPES = new Set(["welcome_screen", "thank_you_screen", "section_header"]);
      for (const block of blocks) {
        if (LAYOUT_TYPES.has(block.type)) continue;
        if ((block as { required?: boolean }).required) {
          const val = answersRecord[block.id];
          if (val === undefined || val === null || val === "") {
            return NextResponse.json(
              { error: `Required field "${block.label}" must be answered` },
              { status: 400 }
            );
          }
        }
      }

      // Enrich answers with block metadata for historical record
      const enrichedAnswers = blocks
        .filter(
          (b) =>
            b.type !== "welcome_screen" &&
            b.type !== "thank_you_screen" &&
            b.type !== "section_header"
        )
        .map((block) => ({
          blockId: block.id,
          blockLabel: block.label,
          blockType: block.type,
          answer: answersRecord[block.id] ?? null,
        }));

      // Calculate scores if enabled
      let scores: unknown = null;
      if (
        questionnaire.scoringEnabled &&
        questionnaire.scoringRules
      ) {
        const scoringConfig = questionnaire.scoringRules as unknown as ScoringConfig;
        scores = calculateFormScores(answersRecord, blocks, scoringConfig);
      }

      const now = new Date();

      const [response] = await prisma.$transaction([
        prisma.questionnaireResponse.create({
          data: {
            questionnaireId: params.id,
            athleteId: athlete.id,
            assignmentId: assignment.id,
            answers: enrichedAnswers as unknown as never,
            scores: scores as never,
            durationSeconds: typeof durationSeconds === "number" ? durationSeconds : null,
            completedAt: now,
          },
        }),
        prisma.questionnaireAssignment.update({
          where: { id: assignment.id },
          data: {
            completedAt: now,
            draftAnswers: Prisma.JsonNull, // Clear draft on submit
          },
        }),
      ]);

      return NextResponse.json({ response }, { status: 201 });
    }

    // ── Legacy question-based form submission ─────────────────────────────
    if (!Array.isArray(answers)) {
      return NextResponse.json(
        { error: "Answers must be an array" },
        { status: 400 }
      );
    }

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

    const enrichedAnswers = answers.map((a: { questionId: string; answer: unknown }) => {
      const question = questions.find((q) => q.id === a.questionId);
      return {
        questionId: a.questionId,
        questionText: question?.text ?? "Unknown question",
        answer: a.answer,
      };
    });

    const now = new Date();

    const [response] = await prisma.$transaction([
      prisma.questionnaireResponse.create({
        data: {
          questionnaireId: params.id,
          athleteId: athlete.id,
          assignmentId: assignment.id,
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
