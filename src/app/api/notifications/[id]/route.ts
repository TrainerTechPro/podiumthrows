import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { markAsRead, deleteNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

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

const PatchSchema = z.object({
  read: z.boolean().nullable().optional(),
});

/* ─── PATCH — mark a single notification read/unread ─────────────────────── */

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await resolveProfileId(session.userId, session.role);
    if (!profileId) {
      return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
    }

    const json = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
    }
    const readValue = parsed.data.read ?? true;

    const updated = await markAsRead(id, profileId, session.role, readValue);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Notification not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { id, read: readValue } });
  } catch (err) {
    logger.error("PATCH /api/notifications/[id]", {
      context: "api",
      metadata: { error: String(err) },
    });
    return NextResponse.json(
      { success: false, error: "Failed to update notification." },
      { status: 500 }
    );
  }
}

/* ─── DELETE — remove a single notification ──────────────────────────────── */

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await resolveProfileId(session.userId, session.role);
    if (!profileId) {
      return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
    }

    const removed = await deleteNotification(id, profileId, session.role);
    if (!removed) {
      return NextResponse.json(
        { success: false, error: "Notification not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (err) {
    logger.error("DELETE /api/notifications/[id]", {
      context: "api",
      metadata: { error: String(err) },
    });
    return NextResponse.json(
      { success: false, error: "Failed to delete notification." },
      { status: 500 }
    );
  }
}
