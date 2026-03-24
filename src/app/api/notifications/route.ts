import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getNotifications, markAllAsRead } from "@/lib/notifications";
import { logger } from "@/lib/logger";

/**
 * Resolve the profile ID for the current session user.
 */
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

/* ─── GET — paginated notifications for current user ─────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await resolveProfileId(session.userId, session.role);
    if (!profileId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10) || 1;
    const limit = parseInt(searchParams.get("limit") ?? "50", 10) || 50;
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const type = searchParams.get("type") ?? undefined;

    const result = await getNotifications(profileId, session.role, {
      page,
      limit,
      unreadOnly,
      type,
    });

    return NextResponse.json(result);
  } catch (err) {
    logger.error("GET /api/notifications", { context: "api", metadata: { error: String(err) } });
    return NextResponse.json({ error: "Failed to fetch notifications." }, { status: 500 });
  }
}

/* ─── PATCH — mark all notifications as read ─────────────────────────────── */

export async function PATCH() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await resolveProfileId(session.userId, session.role);
    if (!profileId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    await markAllAsRead(profileId, session.role);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/notifications", { context: "api", metadata: { error: String(err) } });
    return NextResponse.json({ error: "Failed to update notifications." }, { status: 500 });
  }
}
