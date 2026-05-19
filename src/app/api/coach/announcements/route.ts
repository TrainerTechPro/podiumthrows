import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { getCoachAnnouncements, createAnnouncement } from "@/lib/data/team-hub";
import { parseBody, CoachAnnouncementCreateSchema } from "@/lib/api-schemas";

/* ─── GET — list all non-expired announcements for the coach ─────────────── */

export async function GET() {
  try {
    const { coach } = await requireCoachApi();
    const data = await getCoachAnnouncements(coach.id);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/coach/announcements", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t fetch announcements." },
      { status: 500 }
    );
  }
}

/* ─── POST — create a new announcement ──────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const parsed = await parseBody(req, CoachAnnouncementCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { title, body: bodyText, priority, pinned, targetType, targetId, expiresAt } = parsed;

    // Parse expiresAt
    let expiresAtDate: Date | null = null;
    if (expiresAt) {
      expiresAtDate = new Date(expiresAt);
      if (isNaN(expiresAtDate.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid expiresAt date." },
          { status: 400 }
        );
      }
    }

    const result = await createAnnouncement(coach.id, {
      title: title.trim(),
      body: bodyText.trim(),
      priority: priority ?? undefined,
      pinned: pinned ?? undefined,
      targetType: targetType ?? undefined,
      targetId: targetId ?? null,
      expiresAt: expiresAtDate,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/coach/announcements", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t create announcement." },
      { status: 500 }
    );
  }
}
