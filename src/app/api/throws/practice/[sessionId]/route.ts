import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, PracticeSessionPatchSchema } from "@/lib/api-schemas";

// GET /api/throws/practice/[sessionId] — fetch session with all attempts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
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

    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId },
      include: {
        attempts: {
          include: {
            athlete: {
              select: {
                id: true,
                avatarUrl: true,
                user: { select: { id: true, email: true } },
                throwsProfiles: {
                  where: { status: "active" },
                  select: {
                    event: true,
                    competitionPb: true,
                    heavyImplementKg: true,
                    lightImplementKg: true,
                  },
                },
                throwsPRs: {
                  select: { event: true, implement: true, distance: true },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session || session.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    logger.error("GET /api/throws/practice/[sessionId] error", { context: "throws/practice", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/throws/practice/[sessionId] — update session (close, rename, notes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
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

    const existing = await prisma.practiceSession.findUnique({
      where: { id: sessionId },
    });
    if (!existing || existing.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const parsed = await parseBody(request, PracticeSessionPatchSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { status, name, notes } = parsed;

    const updated = await prisma.practiceSession.update({
      where: { id: sessionId },
      data: {
        ...(status !== undefined && { status }),
        ...(name !== undefined && { name }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error("PATCH /api/throws/practice/[sessionId] error", { context: "throws/practice", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
