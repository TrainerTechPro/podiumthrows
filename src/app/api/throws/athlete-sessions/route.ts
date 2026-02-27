import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

// GET  /api/throws/athlete-sessions?athleteId=...   — list self-logged sessions
// POST /api/throws/athlete-sessions                  — create a self-logged session
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");

    if (!athleteId) {
      return NextResponse.json({ success: false, error: "athleteId is required" }, { status: 400 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const sessions = await prisma.athleteThrowsSession.findMany({
      where: { athleteId },
      include: { drillLogs: { orderBy: { createdAt: "asc" } } },
      orderBy: { date: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (err) {
    logger.error("athlete-sessions GET error", { context: "throws/athlete-sessions", error: err });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { athleteId, event, date, notes, drillLogs } = body;

    if (!athleteId || !event || !date) {
      return NextResponse.json({ success: false, error: "athleteId, event and date are required" }, { status: 400 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const session = await prisma.athleteThrowsSession.create({
      data: {
        athleteId,
        event,
        date,
        notes: notes || null,
        drillLogs: drillLogs?.length
          ? {
              create: (drillLogs as Array<{
                drillType: string;
                implementWeight?: number | null;
                throwCount?: number;
                bestMark?: number | null;
                notes?: string | null;
              }>).map((d) => ({
                drillType: d.drillType,
                implementWeight: d.implementWeight ?? null,
                throwCount: d.throwCount ?? 0,
                bestMark: d.bestMark ?? null,
                notes: d.notes ?? null,
              })),
            }
          : undefined,
      },
      include: { drillLogs: true },
    });

    return NextResponse.json({ success: true, data: session });
  } catch (err) {
    logger.error("athlete-sessions POST error", { context: "throws/athlete-sessions", error: err });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
