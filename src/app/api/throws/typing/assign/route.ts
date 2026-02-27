import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

// POST /api/throws/typing/assign
// Coach assigns the typing quiz to an athlete so it appears on their dashboard.
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coach access required" }, { status: 403 });
    }

    const { athleteId } = await request.json();
    if (!athleteId) {
      return NextResponse.json({ success: false, error: "athleteId is required" }, { status: 400 });
    }

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const today = new Date().toISOString().split("T")[0];

    const typing = await prisma.throwsTyping.upsert({
      where: { athleteId },
      create: {
        athleteId,
        quizAssignedByCoach: true,
        quizAssignedDate: today,
      },
      update: {
        quizAssignedByCoach: true,
        quizAssignedDate: today,
      },
    });

    return NextResponse.json({ success: true, data: typing });
  } catch (err) {
    logger.error("typing/assign POST error", { context: "throws/typing/assign", error: err });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
