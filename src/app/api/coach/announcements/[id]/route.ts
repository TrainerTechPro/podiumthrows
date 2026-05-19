import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { updateAnnouncement, deleteAnnouncement } from "@/lib/data/team-hub";
import { parseBody, CoachAnnouncementUpdateSchema } from "@/lib/api-schemas";

/* ─── PATCH — update an announcement ────────────────────────────────────── */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;
    const parsed = await parseBody(req, CoachAnnouncementUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { title, body: bodyText, priority, pinned, targetType, targetId, expiresAt } = parsed;

    // Parse expiresAt if provided
    let expiresAtDate: Date | null | undefined = undefined;
    if (expiresAt !== undefined) {
      if (expiresAt === null) {
        expiresAtDate = null;
      } else {
        expiresAtDate = new Date(expiresAt);
        if (isNaN(expiresAtDate.getTime())) {
          return NextResponse.json(
            { success: false, error: "Invalid expiresAt date." },
            { status: 400 }
          );
        }
      }
    }

    const updates: Parameters<typeof updateAnnouncement>[2] = {};
    if (typeof title === "string" && title.trim()) updates.title = title.trim();
    if (typeof bodyText === "string" && bodyText.trim()) updates.body = bodyText.trim();
    if (priority) updates.priority = priority;
    if (typeof pinned === "boolean") updates.pinned = pinned;
    if (targetType) updates.targetType = targetType;
    if (targetId !== undefined) updates.targetId = targetId ?? null;
    if (expiresAtDate !== undefined) updates.expiresAt = expiresAtDate;

    await updateAnnouncement(id, coach.id, updates);
    return NextResponse.json({ success: true, data: { id } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "Not found") {
      return NextResponse.json(
        { success: false, error: "Announcement not found." },
        { status: 404 }
      );
    }
    logger.error("PATCH /api/coach/announcements/[id]", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t update announcement." },
      { status: 500 }
    );
  }
}

/* ─── DELETE — delete an announcement ───────────────────────────────────── */

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    await deleteAnnouncement(id, coach.id);
    return NextResponse.json({ success: true, data: { id } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "Not found") {
      return NextResponse.json(
        { success: false, error: "Announcement not found." },
        { status: 404 }
      );
    }
    logger.error("DELETE /api/coach/announcements/[id]", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t delete announcement." },
      { status: 500 }
    );
  }
}
