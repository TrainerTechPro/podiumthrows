import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession, getCoachQuestionnaires } from "@/lib/data/coach";
import prisma from "@/lib/prisma";

const VALID_TYPES = [
  "ONBOARDING", "ASSESSMENT", "CHECK_IN", "READINESS",
  "COMPETITION", "INJURY", "CUSTOM",
];
const VALID_STATUSES = ["draft", "published"];

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

    const {
      title, description, type, status,
      // New block-based fields
      blocks, displayMode, welcomeScreen, thankYouScreen,
      conditionalLogic, scoringEnabled, scoringRules,
      allowAnonymous,
      // Legacy
      questions,
    } = body;

    // Basic validation
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Valid type is required" },
        { status: 400 }
      );
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Status must be draft or published" },
        { status: 400 }
      );
    }

    // Block-based forms: require at least one block (excluding layout-only)
    const hasBlocks = Array.isArray(blocks) && blocks.length > 0;
    const hasQuestions = Array.isArray(questions) && questions.length > 0;

    if (!hasBlocks && !hasQuestions) {
      return NextResponse.json(
        { error: "At least one block or question is required" },
        { status: 400 }
      );
    }

    // Validate blocks if provided
    if (hasBlocks) {
      for (const block of blocks) {
        if (!block.id || !block.type) {
          return NextResponse.json(
            { error: "Each block must have an id and type" },
            { status: 400 }
          );
        }
      }
    }

    const questionnaire = await prisma.questionnaire.create({
      data: {
        coachId: coach.id,
        title: title.trim(),
        description: description?.trim() || null,
        type,
        status: status || "draft",
        // Blocks (new) or questions (legacy)
        blocks: hasBlocks ? blocks : undefined,
        questions: hasQuestions ? questions : [],
        // Advanced fields
        displayMode: displayMode || "ALL_AT_ONCE",
        welcomeScreen: welcomeScreen ?? undefined,
        thankYouScreen: thankYouScreen ?? undefined,
        conditionalLogic: conditionalLogic ?? undefined,
        scoringEnabled: scoringEnabled ?? false,
        scoringRules: scoringRules ?? undefined,
        allowAnonymous: allowAnonymous ?? false,
      },
    });

    return NextResponse.json({ questionnaire }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
