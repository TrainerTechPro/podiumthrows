import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { markAsRead, deleteNotification, resolveNotificationContext } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { parseBody } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ id: string }> };

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

    const ctx = await resolveNotificationContext(session);
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
    }

    const parsed = await parseBody(req, PatchSchema);
    if (parsed instanceof NextResponse) return parsed;
    const readValue = parsed.read ?? true;

    const updated = await markAsRead(id, ctx.profileId, ctx.effectiveRole, readValue);
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

    const ctx = await resolveNotificationContext(session);
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
    }

    const removed = await deleteNotification(id, ctx.profileId, ctx.effectiveRole);
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
