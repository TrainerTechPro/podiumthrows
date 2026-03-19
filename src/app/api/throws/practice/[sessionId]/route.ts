import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

// GET /api/throws/practice/[sessionId] — fetch session with all attempts
export async function GET(
  _request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
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

    const session = await prisma.practiceSession.findUnique({
      where: { id: params.sessionId },
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
  { params }: { params: { sessionId: string } }
) {
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

    const existing = await prisma.practiceSession.findUnique({
      where: { id: params.sessionId },
    });
    if (!existing || existing.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const body = await request.json();
    const { status, name, notes } = body;

    const updated = await prisma.practiceSession.update({
      where: { id: params.sessionId },
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
