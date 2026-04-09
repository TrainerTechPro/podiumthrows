import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ── GET — single session detail ── */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error:"Unauthorized" }, { status: 401 });
    }

    const entry = await prisma.athleteThrowsSession.findUnique({
      where: { id: id },
      include: {
        drillLogs: { orderBy: { createdAt: "asc" } },
        athlete: { select: { userId: true, firstName: true, lastName: true, coachId: true } },
      },
    });

    if (!entry) {
      return NextResponse.json({ success: false, error:"Session not found" }, { status: 404 });
    }

    // Allow access if the user is the athlete OR their coach
    if (entry.athlete.userId !== session.userId) {
      return NextResponse.json({ success: false, error:"Unauthorized" }, { status: 403 });
    }

    if (session.role === "COACH") {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });
      if (!coach || entry.athlete.coachId !== coach.id) {
        return NextResponse.json({ success: false, error:"Unauthorized" }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (err) {
    logger.error("GET /api/athlete/log-session/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error:"Failed to fetch session" }, { status: 500 });
  }
}

/* ── DELETE — remove a self-logged session ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error:"Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error:"Athlete profile not found" }, { status: 404 });
    }

    const entry = await prisma.athleteThrowsSession.findUnique({
      where: { id: id },
      select: { athleteId: true },
    });

    if (!entry || entry.athleteId !== athlete.id) {
      return NextResponse.json({ success: false, error:"Not found or unauthorized" }, { status: 404 });
    }

    await prisma.athleteThrowsSession.delete({ where: { id: id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/athlete/log-session/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error:"Failed to delete" }, { status: 500 });
  }
}
