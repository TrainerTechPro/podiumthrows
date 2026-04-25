import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fetchCoachByUserId } from "@/lib/data/coach";
import { getThrowsSessions } from "@/lib/data/throws";
import { logger } from "@/lib/logger";
import { parseBodyText, ThrowsSessionCreateSchema } from "@/lib/api-schemas";
import { validateSession, type SessionBlock } from "@/lib/throws/validation";
import { withIdempotency } from "@/lib/idempotency";
import { EventType } from "@prisma/client";

// GET /api/throws/sessions — list all throws sessions for current coach
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const coach = await fetchCoachByUserId(currentUser.userId);
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 }
      );
    }

    const sessions = await getThrowsSessions(coach.id);

    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    logger.error("GET /api/throws/sessions error", { context: "throws/sessions", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/throws/sessions — create a new throws session
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "COACH") {
    return NextResponse.json({ success: false, error: "Coach access required" }, { status: 403 });
  }

  return withIdempotency(
    { userId: currentUser.userId, endpoint: "/api/throws/sessions", req },
    async (bodyText) => postHandler(currentUser.userId, bodyText)
  );
}

async function postHandler(userId: string, bodyText: string): Promise<NextResponse> {
  try {
    const coach = await prisma.coachProfile.findUnique({
      where: { userId },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 }
      );
    }

    const parsed = parseBodyText(bodyText, ThrowsSessionCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { name, sessionType, targetPhase, event, estimatedDuration, tags, notes, blocks } =
      parsed;

    // Server-side Bondarchuk methodology enforcement.
    // The builder UI validates before save, but any direct API call (mobile, scripts,
    // integrations) must also pass. A CRITICAL issue (e.g. light→heavy sequence,
    // Vol IV p.114-117) blocks creation with 422. Warnings are allowed through.
    if (blocks && blocks.length > 0) {
      const blocksForValidation: SessionBlock[] = blocks.map((block, index) => ({
        id: `tmp-${index}`,
        blockType: block.blockType,
        position: block.position ?? index,
        config: block.config as SessionBlock["config"],
      }));

      const validation = validateSession(blocksForValidation);
      if (!validation.valid) {
        const summary = validation.errors.map((e) => e.title).join("; ");
        return NextResponse.json(
          {
            success: false,
            error: `Session violates Bondarchuk methodology: ${summary}`,
            issues: validation.errors,
          },
          { status: 422 }
        );
      }
    }

    const session = await prisma.throwsSession.create({
      data: {
        coachId: coach.id,
        name,
        sessionType,
        targetPhase: targetPhase || null,
        event: event as EventType,
        estimatedDuration: estimatedDuration || null,
        tags: tags ? JSON.stringify(tags) : null,
        notes: notes || null,
        blocks: {
          create: (blocks || []).map((block, index) => ({
            blockType: block.blockType,
            position: block.position ?? index,
            config: JSON.stringify(block.config),
          })),
        },
      },
      include: {
        blocks: { orderBy: { position: "asc" } },
      },
    });

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    logger.error("POST /api/throws/sessions error", { context: "throws/sessions", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
