import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ─── GET — list coach notifications ─────────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
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
        athleteId: true,
        metadata: true,
        createdAt: true,
      },
    });

    const unreadCount = await prisma.notification.count({
      where: { coachId: coach.id, read: false },
    });

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        ...n,
        metadata: n.metadata as Record<string, unknown> | null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (err) {
    logger.error("GET /api/coach/notifications", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to fetch notifications." }, { status: 500 });
  }
}

/* ─── PATCH — mark multiple notifications as read ────────────────────────── */

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { ids, read, markAll } = body as Record<string, unknown>;

    const readValue = typeof read === "boolean" ? read : true;

    if (markAll === true) {
      // Mark all as read
      await prisma.notification.updateMany({
        where: { coachId: coach.id },
        data: { read: readValue },
      });
      return NextResponse.json({ success: true });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Provide 'ids' array or set 'markAll: true'." },
        { status: 400 }
      );
    }

    // Only update notifications belonging to this coach
    await prisma.notification.updateMany({
      where: {
        id: { in: ids as string[] },
        coachId: coach.id,
      },
      data: { read: readValue },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/coach/notifications", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to update notifications." }, { status: 500 });
  }
}
