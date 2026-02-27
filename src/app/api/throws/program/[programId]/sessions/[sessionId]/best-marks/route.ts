import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface Params {
  params: Promise<{ programId: string; sessionId: string }>;
}

interface BestMarkInput {
  implement: string;
  distance: number;
  drillType?: string | null;
  notes?: string | null;
}

// ── GET /api/throws/program/[programId]/sessions/[sessionId]/best-marks
// Get best marks per implement for a session.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { programId, sessionId } = await params;

    // Verify session belongs to program
    const session = await prisma.programSession.findUnique({
      where: { id: sessionId },
      select: { programId: true },
    });

    if (!session || session.programId !== programId) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 },
      );
    }

    const bestMarks = await prisma.sessionBestMark.findMany({
      where: { sessionId },
      orderBy: { distance: "desc" },
    });

    return NextResponse.json({ success: true, data: bestMarks });
  } catch (error) {
    logger.error("Get best marks error", {
      context: "throws/program/session/best-marks",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to get best marks" },
      { status: 500 },
    );
  }
}

// ── POST /api/throws/program/[programId]/sessions/[sessionId]/best-marks
// Log best marks per implement for a session.
// Upserts: if a best mark for an implement already exists, updates the distance.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { programId, sessionId } = await params;
    const body = await req.json();

    // Verify session
    const session = await prisma.programSession.findUnique({
      where: { id: sessionId },
      select: { programId: true },
    });

    if (!session || session.programId !== programId) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 },
      );
    }

    // Verify ownership
    const program = await prisma.trainingProgram.findUnique({
      where: { id: programId },
      select: { athleteId: true },
    });

    const athleteProfile = await prisma.athleteProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (program?.athleteId !== athleteProfile?.id) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 },
      );
    }

    // Accept single mark or array of marks
    const marks: BestMarkInput[] = Array.isArray(body.marks)
      ? body.marks
      : [body];

    // Validate
    for (const m of marks) {
      if (!m.implement || typeof m.distance !== "number" || m.distance <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid mark: implement="${m.implement}", distance=${m.distance}. Both are required and distance must be > 0.`,
          },
          { status: 400 },
        );
      }
    }

    // Upsert each best mark
    const results: Awaited<ReturnType<typeof prisma.sessionBestMark.upsert>>[] = [];
    for (const m of marks) {
      const result = await prisma.sessionBestMark.upsert({
        where: {
          sessionId_implement: {
            sessionId,
            implement: m.implement,
          },
        },
        update: {
          distance: m.distance,
          drillType: m.drillType ?? null,
          notes: m.notes ?? null,
        },
        create: {
          sessionId,
          implement: m.implement,
          distance: m.distance,
          drillType: m.drillType ?? null,
          notes: m.notes ?? null,
        },
      });
      results.push(result);
    }

    // Also update the session's overall bestMark to the max across all implements
    const allBestMarks = await prisma.sessionBestMark.findMany({
      where: { sessionId },
      select: { distance: true },
    });
    const overallBest = Math.max(...allBestMarks.map((m) => m.distance));

    await prisma.programSession.update({
      where: { id: sessionId },
      data: {
        bestMark: overallBest,
        // Move to IN_PROGRESS if still planned
        ...(await shouldUpdateStatus(sessionId)),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        logged: results.length,
        marks: results,
        overallBest,
      },
    });
  } catch (error) {
    logger.error("Log best marks error", {
      context: "throws/program/session/best-marks",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to log best marks" },
      { status: 500 },
    );
  }
}

// Helper: check if session status should be moved to IN_PROGRESS
async function shouldUpdateStatus(
  sessionId: string,
): Promise<{ status: string } | Record<string, never>> {
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    select: { status: true },
  });
  if (session?.status === "PLANNED" || session?.status === "SCHEDULED") {
    return { status: "IN_PROGRESS" };
  }
  return {};
}
