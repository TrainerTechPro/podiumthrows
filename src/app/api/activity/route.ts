import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 }
      );
    }

    const logs = await prisma.activityLog.findMany({
      where: { coachId: coach.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    logger.error("Activity log error", { context: "activity", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to load activity logs" },
      { status: 500 }
    );
  }
}
