import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

// GET /api/throwflow/[id] — get a single analysis with full details
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
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

    const analysis = await prisma.throwAnalysis.findUnique({
      where: { id: params.id },
      include: {
        athlete: {
          include: { user: { select: { id: true, email: true } } },
        },
      },
    });

    if (!analysis) {
      return NextResponse.json({ success: false, error: "Analysis not found" }, { status: 404 });
    }

    // Verify ownership
    if (analysis.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
    }

    // Parse JSON fields
    const data = {
      id: analysis.id,
      event: analysis.event,
      drillType: analysis.drillType,
      cameraAngle: analysis.cameraAngle,
      athleteHeight: analysis.athleteHeight,
      implementWeight: analysis.implementWeight,
      knownDistance: analysis.knownDistance,
      phaseScores: parseJson(analysis.phaseScores, { phases: [] }).phases || [],
      energyLeaks: parseJson(analysis.energyLeaks, []),
      releaseMetrics: parseJson(analysis.releaseMetrics, null),
      overallScore: analysis.overallScore,
      issueCards: parseJson(analysis.issueCards, []),
      drillRecs: parseJson(analysis.drillRecs, []),
      rawAnalysis: analysis.rawAnalysis,
      frameCount: analysis.frameCount,
      videoDuration: analysis.videoDuration,
      status: analysis.status,
      errorMessage: analysis.errorMessage,
      createdAt: analysis.createdAt.toISOString(),
      athleteName: analysis.athlete
        ? analysis.athlete.user.email
        : null,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error("GET /api/throwflow/[id] error", { context: "throwflow", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/throwflow/[id] — delete an analysis
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
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

    const analysis = await prisma.throwAnalysis.findUnique({
      where: { id: params.id },
    });

    if (!analysis) {
      return NextResponse.json({ success: false, error: "Analysis not found" }, { status: 404 });
    }

    if (analysis.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
    }

    await prisma.throwAnalysis.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("DELETE /api/throwflow/[id] error", { context: "throwflow", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
