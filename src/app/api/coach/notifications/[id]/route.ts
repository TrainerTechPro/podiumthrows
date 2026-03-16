import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

type RouteContext = { params: { id: string } };

/* ─── PATCH — toggle read state on a single notification ─────────────────── */

export async function PATCH(req: NextRequest, { params }: RouteContext) {
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

    // Verify ownership
    const existing = await prisma.notification.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true, read: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { read } = body as Record<string, unknown>;

    const readValue = typeof read === "boolean" ? read : !existing.read;

    const updated = await prisma.notification.update({
      where: { id: params.id },
      data: { read: readValue },
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

    return NextResponse.json({
      notification: {
        ...updated,
        metadata: updated.metadata as Record<string, unknown> | null,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error("PATCH /api/coach/notifications/[id]", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to update notification." }, { status: 500 });
  }
}
