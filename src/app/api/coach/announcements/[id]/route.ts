import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { updateAnnouncement, deleteAnnouncement } from "@/lib/data/team-hub";

/* ─── PATCH — update an announcement ────────────────────────────────────── */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    const { title, body: bodyText, priority, pinned, targetType, targetId, expiresAt } = body;

    // Validate priority if provided
    const validPriorities = ["NORMAL", "URGENT"];
    if (priority !== undefined && !validPriorities.includes(priority as string)) {
      return NextResponse.json(
        { success: false, error: `priority must be one of: ${validPriorities.join(", ")}` },
        { status: 400 },
      );
    }

    // Validate targetType if provided
    const validTargetTypes = ["ALL", "GROUP", "INDIVIDUAL"];
    if (targetType !== undefined && !validTargetTypes.includes(targetType as string)) {
      return NextResponse.json(
        { success: false, error: `targetType must be one of: ${validTargetTypes.join(", ")}` },
        { status: 400 },
      );
    }

    // Parse expiresAt if provided
    let expiresAtDate: Date | null | undefined = undefined;
    if (expiresAt !== undefined) {
      if (expiresAt === null) {
        expiresAtDate = null;
      } else {
        expiresAtDate = new Date(expiresAt as string);
        if (isNaN(expiresAtDate.getTime())) {
          return NextResponse.json({ success: false, error: "Invalid expiresAt date." }, { status: 400 });
        }
      }
    }

    const updates: Parameters<typeof updateAnnouncement>[2] = {};
    if (typeof title === "string" && title.trim()) updates.title = title.trim();
    if (typeof bodyText === "string" && bodyText.trim()) updates.body = bodyText.trim();
    if (typeof priority === "string") updates.priority = priority;
    if (typeof pinned === "boolean") updates.pinned = pinned;
    if (typeof targetType === "string") updates.targetType = targetType;
    if (targetId !== undefined) updates.targetId = typeof targetId === "string" ? targetId : null;
    if (expiresAtDate !== undefined) updates.expiresAt = expiresAtDate;

    await updateAnnouncement(id, coach.id, updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "Not found") {
      return NextResponse.json({ success: false, error: "Announcement not found." }, { status: 404 });
    }
    logger.error("PATCH /api/coach/announcements/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to update announcement." }, { status: 500 });
  }
}

/* ─── DELETE — delete an announcement ───────────────────────────────────── */

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    await deleteAnnouncement(id, coach.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "Not found") {
      return NextResponse.json({ success: false, error: "Announcement not found." }, { status: 404 });
    }
    logger.error("DELETE /api/coach/announcements/[id]", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to delete announcement." }, { status: 500 });
  }
}
