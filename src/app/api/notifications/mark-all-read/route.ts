import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { markAllAsRead } from "@/lib/notifications";
import { logger } from "@/lib/logger";

async function resolveProfileId(userId: string, role: "COACH" | "ATHLETE"): Promise<string | null> {
  if (role === "COACH") {
    const coach = await prisma.coachProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return coach?.id ?? null;
  }
  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return athlete?.id ?? null;
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await resolveProfileId(session.userId, session.role);
    if (!profileId) {
      return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
    }

    await markAllAsRead(profileId, session.role);
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (err) {
    logger.error("POST /api/notifications/mark-all-read", {
      context: "api",
      metadata: { error: String(err) },
    });
    return NextResponse.json(
      { success: false, error: "Failed to mark notifications as read." },
      { status: 500 }
    );
  }
}
