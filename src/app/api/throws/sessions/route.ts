import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

// GET /api/throws/sessions — list all throws sessions for current coach
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
    }

    const sessions = await prisma.throwsSession.findMany({
      where: { coachId: coach.id },
      include: {
        blocks: { orderBy: { position: "asc" } },
        assignments: {
          include: { athlete: { include: { user: { select: { id: true, email: true } } } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    logger.error("GET /api/throws/sessions error", { context: "throws/sessions", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/throws/sessions — create a new throws session
export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coach access required" }, { status: 403 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, sessionType, targetPhase, event, estimatedDuration, tags, notes, blocks } = body;

    if (!name || !sessionType || !event) {
      return NextResponse.json(
        { success: false, error: "Name, session type, and event are required" },
        { status: 400 }
      );
    }

    const session = await prisma.throwsSession.create({
      data: {
        coachId: coach.id,
        name,
        sessionType,
        targetPhase: targetPhase || null,
        event,
        estimatedDuration: estimatedDuration || null,
        tags: tags ? JSON.stringify(tags) : null,
        notes: notes || null,
        blocks: {
          create: (blocks || []).map((block: { blockType: string; position: number; config: unknown }, index: number) => ({
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
