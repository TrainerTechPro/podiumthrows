import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody, CoachNotificationsBulkSchema } from "@/lib/api-schemas";

/* ─── GET — list coach notifications ─────────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limitParam = parseInt(searchParams.get("limit") ?? "50", 10);
    const limit = isNaN(limitParam) || limitParam < 1 ? 50 : Math.min(limitParam, 100);

    const notifications = await prisma.notification.findMany({
      where: {
        coachId: coach.id,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        read: true,
        athleteProfileId: true,
        metadata: true,
        createdAt: true,
      },
    });

    const unreadCount = await prisma.notification.count({
      where: { coachId: coach.id, read: false },
    });

    return NextResponse.json({
      success: true,
      data: {
        notifications: notifications.map((n) => ({
          ...n,
          metadata: n.metadata as Record<string, unknown> | null,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount,
      },
    });
  } catch (err) {
    logger.error("GET /api/coach/notifications", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t fetch notifications." },
      { status: 500 }
    );
  }
}

/* ─── PATCH — mark multiple notifications as read ────────────────────────── */

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const parsed = await parseBody(req, CoachNotificationsBulkSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { ids, read, markAll } = parsed;

    const readValue = typeof read === "boolean" ? read : true;

    if (markAll === true) {
      const updated = await prisma.notification.updateMany({
        where: { coachId: coach.id },
        data: { read: readValue },
      });
      return NextResponse.json({ success: true, data: { updated: updated.count } });
    }

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Provide 'ids' array or set 'markAll: true'." },
        { status: 400 }
      );
    }

    // Only update notifications belonging to this coach
    const updated = await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        coachId: coach.id,
      },
      data: { read: readValue },
    });

    return NextResponse.json({ success: true, data: { updated: updated.count } });
  } catch (err) {
    logger.error("PATCH /api/coach/notifications", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t update notifications." },
      { status: 500 }
    );
  }
}
