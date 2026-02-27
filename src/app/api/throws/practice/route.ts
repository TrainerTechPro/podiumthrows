import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

// GET /api/throws/practice — list all practice sessions for the coach
export async function GET() {
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

    const sessions = await prisma.practiceSession.findMany({
      where: { coachId: coach.id },
      include: {
        _count: { select: { attempts: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    logger.error("GET /api/throws/practice error", { context: "throws/practice", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/throws/practice — create a new practice session
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, date, notes } = body;

    if (!name || !date) {
      return NextResponse.json({ success: false, error: "Name and date are required" }, { status: 400 });
    }

    const session = await prisma.practiceSession.create({
      data: {
        coachId: coach.id,
        name,
        date,
        notes: notes || null,
      },
    });

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    logger.error("POST /api/throws/practice error", { context: "throws/practice", error: error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
