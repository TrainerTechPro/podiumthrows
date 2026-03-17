import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

// GET /api/throws/sessions/[id] — get a single throws session with blocks and assignments
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const session = await prisma.throwsSession.findUnique({
      where: { id: params.id },
      include: {
        blocks: { orderBy: { position: "asc" } },
        assignments: {
          include: {
            athlete: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { assignedDate: "desc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    // Verify ownership
    if (session.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    logger.error("GET /api/throws/sessions/[id] error", { context: "throws/sessions/[id]", error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/throws/sessions/[id] — delete a throws session
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const session = await prisma.throwsSession.findUnique({
      where: { id: params.id },
      select: { coachId: true },
    });

    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    if (session.coachId !== coach.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    await prisma.throwsSession.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("DELETE /api/throws/sessions/[id] error", { context: "throws/sessions/[id]", error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
